import { create } from 'zustand';
import { callAI } from '../api/callAI';
import { buildFullPrompt, buildVotePrompt, buildFinalSummaryPrompt, formatHistoryForProvider } from '../utils/prompt';

function delay(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

function sanitizeImageRecognitions(list) {
  if (!Array.isArray(list)) return [];
  const now = Date.now();
  return list.map((item, idx) => {
    const status = normalizeStatus(item);
    return {
      id: item?.id || `img-${now}-${idx}`,
      name: item?.name || '',
      dataUrl: item?.dataUrl || item?.imageUrl || '',
      result: item?.result || '',
      status,
      error: item?.error || '',
      createdAt: item?.createdAt || now,
      raw: status === 'queued' || status === 'recognizing' ? item?.raw || '' : ''
    };
  });
}

function normalizeStatus(item) {
  const status = item?.status;
  if (status === 'queued' || status === 'recognizing') return 'queued';
  if (status === 'error') return 'error';
  if (status === 'success') return 'success';
  if (item?.error) return 'error';
  if (item?.result) return 'success';
  return 'queued';
}

function summarizeImageRecognitions(list) {
  if (!Array.isArray(list) || !list.length) return '';
  return list
    .map((entry, idx) => ({ entry, idx }))
    .filter(({ entry }) => entry.status === 'success' && entry.result)
    .map(({ entry, idx }) => {
      const namePart = entry.name ? `（${entry.name}）` : '';
      return `图片${idx + 1}${namePart}: ${entry.result}`;
    })
    .join('\n');
}

function sanitizeLinkedConsultations(list) {
  if (!Array.isArray(list)) return [];
  return list
    .map((item, idx) => {
      if (!item) return null;
      const id = typeof item.id === 'string' && item.id ? item.id : item?.sourceId || `linked-${idx}`;
      const patientAge = item?.patientAge;
      return {
        id,
        sourceId: item?.sourceId || id,
        consultationName: item?.consultationName || item?.name || `关联问诊${idx + 1}`,
        patientName: item?.patientName || '',
        patientGender: item?.patientGender || '',
        patientAge: Number.isFinite(patientAge) ? patientAge : patientAge === null || patientAge === undefined ? null : Number(patientAge) || null,
        pastHistory: item?.pastHistory || '',
        currentProblem: item?.currentProblem || '',
        imageRecognitionResult: item?.imageRecognitionResult || '',
        finalSummary: item?.finalSummary || '',
        finishedAt: item?.finishedAt || item?.finishedAt || '',
        metadata: item?.metadata || null
      };
    })
    .filter(Boolean);
}

const initialState = {
  consultationName: '',
  settings: {
    globalSystemPrompt:
      '你是一位顶级的、经验丰富的临床诊断医生。你的任务是基于提供的患者病历进行分析和诊断。\n\n现在，你正在参与一个多方专家会诊。你会看到其他医生的诊断意见。请综合考虑他们的分析，这可能会启发你，但你必须保持自己独立的专业判断。\n\n你的发言必须遵循以下原则：\n1.  专业严谨: 你的分析必须基于医学知识和病历信息。\n2.  独立思考: 不要为了迎合他人而轻易改变自己的核心观点。如果其他医生的观点是正确的，你可以表示赞同并加以补充；如果观点有误或你持有不同看法，必须明确、有理有据地指出。\n3.  目标导向: 会诊的唯一目标是为患者找到最佳的解决方案。\n4.  简洁清晰: 直接陈述你的核心诊断、分析和建议。\n\n现在，请根据下面的病历和已有的讨论，发表你的看法。',
    summaryPrompt: '请根据完整会诊内容，以临床医生口吻输出最终总结：包含核心诊断、依据、鉴别诊断、检查建议、治疗建议、随访计划和风险提示。',
    turnOrder: 'random',
    maxRoundsWithoutElimination: 3
  },
  doctors: [],
  patientCase: {
    name: '',
    gender: '',
    age: null,
    pastHistory: '',
    currentProblem: '',
    imageRecognitionResult: '',
    imageRecognitions: []
  },
  linkedConsultations: [],
  workflow: {
    phase: 'setup',
    currentRound: 0,
    roundsWithoutElimination: 0,
    activeTurn: null,
    turnQueue: [],
    paused: false
  },
  discussionHistory: [],
  lastRoundVotes: [],
  finalSummary: { status: 'idle', doctorId: null, doctorName: '', content: '', usedPrompt: '' }
};

export const useConsultStore = create((set, get) => ({
  ...initialState,

  // Computed values
  get activeDoctors() {
    return get().doctors.filter((d) => d.status === 'active');
  },
  get anyApiKeys() {
    return get().doctors.some((d) => d.apiKey);
  },

  // Actions
  setConsultationName: (name) => {
    const value = typeof name === 'string' ? name.trim() : '';
    set({ consultationName: value });
  },

  setSettings: (newSettings) => {
    set((state) => ({
      settings: { ...state.settings, ...newSettings }
    }));
  },

  setDoctors: (newDoctors) => {
    set({ doctors: newDoctors });
  },

  setPatientCase: (caseInfo) => {
    set((state) => {
      const payload = { ...state.patientCase, ...caseInfo };
      if (caseInfo?.imageRecognitions !== undefined) {
        payload.imageRecognitions = sanitizeImageRecognitions(caseInfo.imageRecognitions);
        const summary = summarizeImageRecognitions(payload.imageRecognitions);
        if (summary) {
          payload.imageRecognitionResult = summary;
        } else if (!payload.imageRecognitionResult) {
          payload.imageRecognitionResult = '';
        }
      }
      if (!Array.isArray(payload.imageRecognitions)) {
        payload.imageRecognitions = [];
      }
      return { patientCase: payload };
    });
  },

  setLinkedConsultations: (list, options = {}) => {
    const { syncPatientInfo = true } = options;
    const sanitized = sanitizeLinkedConsultations(list);
    set({ linkedConsultations: sanitized });
    
    if (syncPatientInfo && sanitized.length > 0) {
      const first = sanitized[0];
      const update = {};
      if (first.patientName !== undefined && first.patientName !== null) {
        update.name = String(first.patientName).trim();
      }
      if (first.patientGender !== undefined && first.patientGender !== null) {
        update.gender = String(first.patientGender).trim();
      }
      if (first.patientAge !== undefined) {
        if (first.patientAge === null || first.patientAge === undefined || first.patientAge === '') {
          update.age = null;
        } else {
          const ageNumber = Number(first.patientAge);
          update.age = Number.isFinite(ageNumber) ? ageNumber : null;
        }
      }
      if (Object.keys(update).length > 0) {
        get().setPatientCase(update);
      }
    }
  },

  addPatientMessage: (text) => {
    const content = String(text || '').trim();
    if (!content) return;
    const state = get();
    const name = state.patientCase?.name ? `患者（${state.patientCase.name}）` : '患者';
    set((state) => ({
      discussionHistory: [...state.discussionHistory, { type: 'patient', author: name, content }]
    }));
  },

  resetVotes: () => {
    set((state) => ({
      doctors: state.doctors.map((d) => ({ ...d, votes: 0 }))
    }));
  },

  startConsultation: async () => {
    const state = get();
    if (!state.patientCase.name || !state.patientCase.currentProblem) {
      throw new Error('请填写患者名称和本次问题');
    }
    if (!state.doctors || state.doctors.length === 0) {
      throw new Error('请添加至少一位医生后再开始会诊（可在设置中添加）');
    }

    set((state) => ({
      doctors: state.doctors.map((d) => ({ ...d, status: 'active', votes: 0 })),
      workflow: {
        ...state.workflow,
        phase: 'discussion',
        currentRound: 1,
        roundsWithoutElimination: 0,
        paused: false
      },
      finalSummary: { status: 'idle', doctorId: null, doctorName: '', content: '', usedPrompt: '' },
      discussionHistory: [...state.discussionHistory, { type: 'system', content: `第 1 轮会诊开始` }]
    }));

    get().generateTurnQueue();
    get().runDiscussionRound();
  },

  generateTurnQueue: () => {
    set((state) => {
      const actives = state.doctors.filter((d) => d.status === 'active').map((d) => d.id);
      let turnQueue;
      if (state.settings.turnOrder === 'random') {
        turnQueue = actives
          .map((id) => ({ id, r: Math.random() }))
          .sort((a, b) => a.r - b.r)
          .map((x) => x.id);
      } else {
        turnQueue = state.doctors.filter((d) => d.status === 'active').map((d) => d.id);
      }
      return {
        workflow: { ...state.workflow, turnQueue }
      };
    });
  },

  runDiscussionRound: async () => {
    const state = get();
    for (const doctorId of state.workflow.turnQueue) {
      const doctor = get().doctors.find((d) => d.id === doctorId);
      if (!doctor || doctor.status !== 'active') continue;

      await get().waitWhilePaused();

      set((state) => ({
        workflow: { ...state.workflow, activeTurn: doctorId }
      }));

      set((state) => ({
        discussionHistory: [...state.discussionHistory, { type: 'system', content: `${doctor.name} 正在输入...` }]
      }));
      const typingIndex = get().discussionHistory.length - 1;

      const currentState = get();
      const systemPrompt = doctor.customPrompt || currentState.settings.globalSystemPrompt;
      const fullPrompt = buildFullPrompt(systemPrompt, currentState.patientCase, currentState.discussionHistory, doctor.id, currentState.linkedConsultations);
      
      try {
        const providerHistory = formatHistoryForProvider(currentState.discussionHistory, currentState.patientCase, doctor.id);
        const response = await callAI(doctor, fullPrompt, providerHistory);

        set((state) => {
          const newHistory = [...state.discussionHistory];
          newHistory.splice(typingIndex, 1);
          return { discussionHistory: newHistory };
        });

        const msg = { type: 'doctor', doctorId: doctor.id, doctorName: doctor.name, content: '' };
        set((state) => ({
          discussionHistory: [...state.discussionHistory, msg]
        }));
        const messageIndex = get().discussionHistory.length - 1;

        for (let i = 0; i < response.length; i++) {
          await get().waitWhilePaused();
          set((state) => {
            const newHistory = [...state.discussionHistory];
            newHistory[messageIndex] = {
              ...newHistory[messageIndex],
              content: newHistory[messageIndex].content + response[i]
            };
            return { discussionHistory: newHistory };
          });
          await delay(15);
        }

        set((state) => ({
          workflow: { ...state.workflow, activeTurn: null }
        }));
      } catch (e) {
        set((state) => {
          const newHistory = [...state.discussionHistory];
          try {
            newHistory.splice(typingIndex, 1);
          } catch (err) {}
          newHistory.push({
            type: 'doctor',
            doctorId: doctor.id,
            doctorName: doctor.name,
            content: `调用 ${doctor.name} 失败: ${e.message || e}`
          });
          return {
            workflow: { ...state.workflow, activeTurn: null },
            discussionHistory: newHistory
          };
        });
      }
    }

    set((state) => ({
      workflow: { ...state.workflow, phase: 'voting' },
      discussionHistory: [...state.discussionHistory, { type: 'system', content: '本轮发言结束，医生团队正在评估答案...' }]
    }));

    await get().autoVoteAndProceed();
  },

  pause: () => {
    set((state) => ({
      workflow: { ...state.workflow, paused: true }
    }));
  },

  resume: () => {
    set((state) => ({
      workflow: { ...state.workflow, paused: false }
    }));
  },

  togglePause: () => {
    set((state) => ({
      workflow: { ...state.workflow, paused: !state.workflow.paused }
    }));
  },

  waitWhilePaused: async () => {
    while (get().workflow.paused) {
      await delay(100);
    }
  },

  autoVoteAndProceed: async () => {
    get().resetVotes();
    set({ lastRoundVotes: [] });

    function parseVoteJSON(text) {
      if (!text || typeof text !== 'string') return null;
      const start = text.indexOf('{');
      const end = text.lastIndexOf('}');
      if (start !== -1 && end !== -1 && end > start) {
        const candidate = text.slice(start, end + 1);
        try {
          return JSON.parse(candidate);
        } catch (e) {
          try {
            const fixed = candidate.replace(/'/g, '"');
            return JSON.parse(fixed);
          } catch (e2) {
            return null;
          }
        }
      }
      return null;
    }

    const state = get();
    const activeDocs = state.doctors.filter((d) => d.status === 'active');
    const activeIds = activeDocs.map((d) => d.id);

    for (const voterDoc of activeDocs) {
      await get().waitWhilePaused();
      let targetId = null;
      let reason = '';

      try {
        if (!voterDoc.apiKey) {
          targetId = voterDoc.id;
          reason = '模拟模式：自评其答案需进一步论证，标注自己。';
        } else {
          const currentState = get();
          const systemPrompt = voterDoc.customPrompt || currentState.settings.globalSystemPrompt;
          const fullPrompt = buildVotePrompt(systemPrompt, currentState.patientCase, currentState.discussionHistory, activeDocs, voterDoc, currentState.linkedConsultations);
          const providerHistory = formatHistoryForProvider(currentState.discussionHistory, currentState.patientCase, voterDoc.id);
          const response = await callAI(voterDoc, fullPrompt, providerHistory);
          const parsed = parseVoteJSON(response);
          if (parsed && typeof parsed.targetDoctorId === 'string') {
            targetId = parsed.targetDoctorId;
            reason = String(parsed.reason || '').trim() || '综合讨论后做出的判断。';
          }
        }
      } catch (e) {
        // Ignore errors
      }

      if (!targetId || !activeIds.includes(targetId)) {
        targetId = voterDoc.id;
        if (!reason) reason = '解析失败：默认标注自己。';
      }

      const targetDoc = get().doctors.find((d) => d.id === targetId);

      set((state) => ({
        lastRoundVotes: [
          ...state.lastRoundVotes,
          {
            round: state.workflow.currentRound,
            voterId: voterDoc?.id,
            voterName: voterDoc?.name,
            targetId: targetDoc?.id,
            targetName: targetDoc?.name,
            reason
          }
        ],
        discussionHistory: [
          ...state.discussionHistory,
          {
            type: 'vote_detail',
            voterId: voterDoc?.id,
            voterName: voterDoc?.name,
            targetId: targetDoc?.id,
            targetName: targetDoc?.name,
            reason
          }
        ]
      }));

      get().voteForDoctor(targetId);
      await delay(50);
    }

    await delay(200);
    await get().confirmVote();
  },

  voteForDoctor: (doctorId) => {
    set((state) => ({
      doctors: state.doctors.map((d) => (d.id === doctorId ? { ...d, votes: d.votes + 1 } : d))
    }));
  },

  confirmVote: async () => {
    const result = get().tallyVotes();
    set((state) => ({
      discussionHistory: [...state.discussionHistory, { type: 'vote_result', content: result.message }]
    }));
    
    const ended = get().checkEndConditions(result.eliminated);
    if (!ended) {
      get().resetVotes();
      set((state) => ({
        workflow: {
          ...state.workflow,
          currentRound: state.workflow.currentRound + 1,
          phase: 'discussion'
        },
        discussionHistory: [...state.discussionHistory, { type: 'system', content: `第 ${state.workflow.currentRound + 1} 轮会诊开始` }]
      }));
      get().generateTurnQueue();
      await get().runDiscussionRound();
    }
  },

  generateFinalSummary: async (preferredDoctorId) => {
    try {
      const state = get();
      const activeDocs = state.doctors.filter((d) => d.status === 'active');
      const summarizer = preferredDoctorId ? state.doctors.find((d) => d.id === preferredDoctorId) : (activeDocs[0] || state.doctors[0] || null);
      if (!summarizer) return;
      
      const usedPrompt = state.settings.summaryPrompt || '请根据完整会诊内容，以临床医生口吻输出最终总结：包含核心诊断、依据、鉴别诊断、检查建议、治疗建议、随访计划和风险提示。';
      
      set({
        finalSummary: { status: 'pending', doctorId: summarizer.id, doctorName: summarizer.name, content: '', usedPrompt }
      });

      const currentState = get();
      const fullPrompt = buildFinalSummaryPrompt(usedPrompt, currentState.patientCase, currentState.discussionHistory, summarizer.id, currentState.linkedConsultations);
      const providerHistory = formatHistoryForProvider(currentState.discussionHistory, currentState.patientCase, summarizer.id);
      const response = await callAI(summarizer, fullPrompt, providerHistory);
      
      set({
        finalSummary: { status: 'ready', doctorId: summarizer.id, doctorName: summarizer.name, content: response, usedPrompt }
      });
    } catch (e) {
      set((state) => ({
        finalSummary: { ...(state.finalSummary || {}), status: 'error', content: `生成总结失败：${e?.message || e}` }
      }));
    }
  },

  tallyVotes: () => {
    const state = get();
    const activeOrElim = state.doctors.filter((d) => d.status === 'active');
    const maxVotes = Math.max(0, ...activeOrElim.map((d) => d.votes));
    const top = activeOrElim.filter((d) => d.votes === maxVotes);
    
    if (top.length !== 1 || maxVotes === 0) {
      set((state) => ({
        workflow: {
          ...state.workflow,
          roundsWithoutElimination: state.workflow.roundsWithoutElimination + 1
        }
      }));
      return { eliminated: null, message: '评估结束：因意见不一或未明确，本轮未标注不太准确。' };
    }
    
    const target = top[0];
    set((state) => ({
      doctors: state.doctors.map((d) => (d.id === target.id ? { ...d, status: 'eliminated' } : d)),
      workflow: {
        ...state.workflow,
        roundsWithoutElimination: 0
      }
    }));
    return { eliminated: target, message: `评估结束：${target.name} 已被标注为不太准确，并暂停参与后续讨论。` };
  },

  checkEndConditions: (eliminated) => {
    const state = get();
    const activeCount = state.doctors.filter((d) => d.status === 'active').length;
    
    if (state.workflow.roundsWithoutElimination >= state.settings.maxRoundsWithoutElimination) {
      set((state) => ({
        workflow: { ...state.workflow, phase: 'finished' },
        discussionHistory: [...state.discussionHistory, { type: 'system', content: '达到未标注不太准确轮数上限，会诊结束。' }]
      }));
      get().generateFinalSummary();
      return true;
    }
    
    if (activeCount <= 1) {
      const winner = state.doctors.find((d) => d.status === 'active');
      const message = activeCount === 1
        ? `会诊结束：采用 ${winner?.name || ''} 的答案。`
        : '会诊结束：无在席医生。';
      
      set((state) => ({
        workflow: { ...state.workflow, phase: 'finished' },
        discussionHistory: [...state.discussionHistory, { type: 'system', content: message }]
      }));
      get().generateFinalSummary(winner?.id);
      return true;
    }
    
    set((state) => ({
      workflow: { ...state.workflow, phase: 'voting' }
    }));
    return false;
  },

  // Reset all state
  reset: () => {
    set(initialState);
  }
}));
