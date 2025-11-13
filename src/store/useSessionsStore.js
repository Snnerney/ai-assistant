import { create } from 'zustand';

function nowISOString() {
  return new Date().toISOString();
}

function statusText(phase) {
  switch (phase) {
    case 'setup':
      return '配置/准备';
    case 'discussion':
      return '讨论中';
    case 'voting':
      return '评估中';
    case 'finished':
      return '已结束';
    default:
      return String(phase || '未知');
  }
}

const META_KEY = 'consult_sessions_meta';
const CURRENT_KEY = 'consult_sessions_current';

function loadMeta() {
  try {
    const raw = localStorage.getItem(META_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) return arr;
    return [];
  } catch (e) {
    return [];
  }
}

function saveMeta(meta) {
  localStorage.setItem(META_KEY, JSON.stringify(meta));
}

function saveCurrentId(id) {
  localStorage.setItem(CURRENT_KEY, id || '');
}

function sanitizeConsultDoctors(list) {
  return (list || []).map((d) => ({
    ...d,
    status: d?.status || 'active',
    votes: typeof d?.votes === 'number' ? d.votes : 0
  }));
}

function loadCurrentId() {
  return localStorage.getItem(CURRENT_KEY) || '';
}

function dataKey(id) {
  return `consult_session_data_${id}`;
}

function loadData(id) {
  try {
    const raw = localStorage.getItem(dataKey(id));
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function saveData(id, data) {
  localStorage.setItem(dataKey(id), JSON.stringify(data));
}

export const useSessionsStore = create((set, get) => ({
  sessions: [],
  currentId: '',

  // Computed
  get current() {
    return get().sessions.find((s) => s.id === get().currentId) || null;
  },

  init: (consultStore) => {
    const sessions = loadMeta();
    const currentId = loadCurrentId();
    
    set({ sessions, currentId });

    if (!sessions.length) {
      const id = get().createNew('新建问诊');
      get().switchTo(id, consultStore);
    } else if (!currentId || !sessions.find((s) => s.id === currentId)) {
      get().switchTo(sessions[0].id, consultStore);
    } else {
      get().switchTo(currentId, consultStore);
    }
  },

  createNew: (name) => {
    const id = `consult-${Date.now()}`;
    const ts = nowISOString();
    const initialName = typeof name === 'string' && name.trim() ? name.trim() : '未命名问诊';
    const meta = { id, name: initialName, status: '配置/准备', createdAt: ts, updatedAt: ts };
    
    set((state) => ({
      sessions: [meta, ...state.sessions]
    }));
    saveMeta(get().sessions);
    
    saveData(id, {
      consultationName: initialName,
      settings: undefined,
      doctors: [],
      patientCase: { name: '', gender: '', age: null, pastHistory: '', currentProblem: '', imageRecognitionResult: '', imageRecognitions: [] },
      linkedConsultations: [],
      workflow: { phase: 'setup', currentRound: 0, roundsWithoutElimination: 0, activeTurn: null, turnQueue: [], paused: false },
      discussionHistory: [],
      finalSummary: { status: 'idle', doctorId: null, doctorName: '', content: '', usedPrompt: '' }
    });
    
    return id;
  },

  rename: (id, newName) => {
    set((state) => ({
      sessions: state.sessions.map((s) => 
        s.id === id ? { ...s, name: newName, updatedAt: nowISOString() } : s
      )
    }));
    saveMeta(get().sessions);
  },

  remove: (id, consultStore) => {
    set((state) => ({
      sessions: state.sessions.filter((s) => s.id !== id)
    }));
    saveMeta(get().sessions);
    
    try {
      localStorage.removeItem(dataKey(id));
    } catch (e) {}

    if (get().currentId === id) {
      const next = get().sessions[0];
      if (next) {
        get().switchTo(next.id, consultStore);
      } else {
        const nid = get().createNew('新建问诊');
        get().switchTo(nid, consultStore);
      }
    }
  },

  switchTo: (id, consultStore) => {
    const meta = get().sessions.find((s) => s.id === id);
    if (!meta) return;

    set({ currentId: id });
    saveCurrentId(id);

    const payload = loadData(id);
    
    if (payload && typeof payload === 'object' && consultStore) {
      // Load data into consult store
      consultStore.setConsultationName(typeof payload.consultationName === 'string' ? payload.consultationName : '');
      
      if (payload.settings) consultStore.setSettings(payload.settings);
      
      if (payload.doctors !== undefined) {
        consultStore.setDoctors(sanitizeConsultDoctors(payload.doctors));
      } else {
        consultStore.setDoctors([]);
      }
      
      if (payload.patientCase) consultStore.setPatientCase(payload.patientCase);
      consultStore.setLinkedConsultations(payload.linkedConsultations || [], { syncPatientInfo: false });
      
      // Directly set workflow, discussionHistory, finalSummary, lastRoundVotes using Zustand's set
      const updates = {};
      if (payload.workflow) updates.workflow = payload.workflow;
      if (payload.discussionHistory) updates.discussionHistory = payload.discussionHistory;
      if (payload.finalSummary) updates.finalSummary = payload.finalSummary;
      if (Array.isArray(payload.lastRoundVotes)) updates.lastRoundVotes = payload.lastRoundVotes;
      
      if (Object.keys(updates).length > 0) {
        consultStore.getState && Object.assign(consultStore.getState(), updates);
      }
    } else if (consultStore) {
      // Reset consult store
      consultStore.setConsultationName('');
      consultStore.setDoctors([]);
      consultStore.setPatientCase({ 
        name: '', 
        gender: '', 
        age: null, 
        pastHistory: '', 
        currentProblem: '', 
        imageRecognitionResult: '', 
        imageRecognitions: [] 
      });
      consultStore.setLinkedConsultations([], { syncPatientInfo: false });
      
      // Reset other fields
      if (consultStore.getState) {
        Object.assign(consultStore.getState(), {
          workflow: { phase: 'setup', currentRound: 0, roundsWithoutElimination: 0, activeTurn: null, turnQueue: [], paused: false },
          discussionHistory: [],
          finalSummary: { status: 'idle', doctorId: null, doctorName: '', content: '', usedPrompt: '' },
          lastRoundVotes: []
        });
      }
    }
  },

  saveSnapshotFromConsult: (consultState) => {
    const currentId = get().currentId;
    if (!currentId) return;

    const snapshot = JSON.parse(JSON.stringify(consultState));
    saveData(currentId, snapshot);

    const status = statusText(consultState.workflow?.phase);
    set((state) => ({
      sessions: state.sessions.map((s) => 
        s.id === currentId ? { ...s, status, updatedAt: nowISOString() } : s
      )
    }));
    saveMeta(get().sessions);
  },

  exportJSON: (id) => {
    const payload = loadData(id);
    const meta = get().sessions.find((s) => s.id === id);
    return JSON.stringify({ meta, data: payload }, null, 2);
  },

  getSessionData: (id) => {
    return loadData(id);
  }
}));
