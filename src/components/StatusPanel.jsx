import React, { useState, useRef, useMemo } from 'react';
import { Card, Descriptions, Button, Alert, Tag, Modal, Popconfirm, message } from 'antd';
import { marked } from 'marked';
import { useConsultStore } from '../store/useConsultStore';
import { useSessionsStore } from '../store/useSessionsStore';
import DoctorList from './DoctorList';
import VoteTally from './VoteTally';
import ExpandableText from './ExpandableText';
import { exportSessionAsPDF, exportSessionAsImage } from '../utils/exportSession';
import './StatusPanel.css';

function StatusPanel({ onOpenSettings }) {
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [isExportingSession, setIsExportingSession] = useState(false);
  const exportRef = useRef(null);

  const workflow = useConsultStore((state) => state.workflow);
  const patientCase = useConsultStore((state) => state.patientCase);
  const doctors = useConsultStore((state) => state.doctors);
  const lastRoundVotes = useConsultStore((state) => state.lastRoundVotes);
  const finalSummary = useConsultStore((state) => state.finalSummary);

  const currentSession = useSessionsStore((state) => state.current);
  const currentId = useSessionsStore((state) => state.currentId);
  const getSessionData = useSessionsStore((state) => state.getSessionData);

  const hasImageRecognitions = useMemo(() => {
    const recognitions = patientCase?.imageRecognitions || [];
    return (recognitions && recognitions.length > 0) || !!patientCase?.imageRecognitionResult;
  }, [patientCase]);

  const phaseText = useMemo(() => {
    switch (workflow.phase) {
      case 'setup':
        return '配置/准备';
      case 'discussion':
        return '讨论中';
      case 'voting':
        return '评估中';
      case 'finished':
        return '已结束';
      default:
        return workflow.phase;
    }
  }, [workflow.phase]);

  const winnerText = useMemo(() => {
    const actives = doctors.filter((d) => d.status === 'active');
    if (actives.length === 1) return `最终答案来自：${actives[0].name}`;
    return '已达到未标注不太准确轮数上限';
  }, [doctors]);

  function renderMarkdown(text) {
    try {
      return marked.parse(text || '');
    } catch (e) {
      return text;
    }
  }

  const exportSummaryImage = async () => {
    const node = exportRef.current;
    if (!node) return;
    try {
      const dataUrl = await window.htmlToImage.toPng(node, { pixelRatio: 2, cacheBust: true });
      const a = document.createElement('a');
      const fileBase = patientCase?.name ? `${patientCase.name}-最终答案` : '最终答案';
      a.href = dataUrl;
      a.download = `${fileBase}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (e) {
      console.error(e);
    }
  };

  const exportCurrentSessionAsPDF = async () => {
    try {
      setIsExportingSession(true);
      const sessionData = getSessionData(currentId);
      const meta = currentSession;

      if (!sessionData) {
        message.error('会诊数据不存在');
        return;
      }

      const fileName = `${meta?.name || '会诊报告'}.pdf`;
      await exportSessionAsPDF(meta, sessionData, fileName);
      message.success('PDF 导出成功');
    } catch (error) {
      console.error('Export PDF error:', error);
      message.error('导出 PDF 失败：' + (error?.message || '未知错误'));
    } finally {
      setIsExportingSession(false);
    }
  };

  const exportCurrentSessionAsImage = async () => {
    try {
      setIsExportingSession(true);
      const sessionData = getSessionData(currentId);
      const meta = currentSession;

      if (!sessionData) {
        message.error('会诊数据不存在');
        return;
      }

      const fileName = `${meta?.name || '会诊报告'}.png`;
      await exportSessionAsImage(meta, sessionData, fileName);
      message.success('图片导出成功');
    } catch (error) {
      console.error('Export image error:', error);
      message.error('导出图片失败：' + (error?.message || '未知错误'));
    } finally {
      setIsExportingSession(false);
    }
  };

  const resetAll = () => {
    const store = useConsultStore.getState();
    // Reset workflow
    store.workflow = {
      phase: 'setup',
      currentRound: 0,
      roundsWithoutElimination: 0,
      activeTurn: null,
      turnQueue: [],
      paused: false
    };
    // Reset doctors
    store.setDoctors(
      store.doctors.map((d) => ({
        ...d,
        status: 'active',
        votes: 0
      }))
    );
    // Reset other states
    Object.assign(store, {
      discussionHistory: [],
      lastRoundVotes: [],
      patientCase: {
        name: '',
        gender: '',
        age: null,
        pastHistory: '',
        currentProblem: '',
        imageRecognitionResult: '',
        imageRecognitions: []
      },
      finalSummary: {
        status: 'idle',
        doctorId: null,
        doctorName: '',
        content: '',
        usedPrompt: ''
      }
    });
  };

  return (
    <>
      <Card title="状态面板" bordered={false} className="status-panel-card">
        <Descriptions size="small" bordered column={1} style={{ marginBottom: '12px' }}>
          <Descriptions.Item label="阶段">{phaseText}</Descriptions.Item>
          <Descriptions.Item label="当前轮次">{workflow.currentRound}</Descriptions.Item>
          <Descriptions.Item label="连续未标注不太准确轮数">
            {workflow.roundsWithoutElimination}
          </Descriptions.Item>
        </Descriptions>

        <Descriptions size="small" bordered column={1} style={{ marginBottom: '12px' }}>
          <Descriptions.Item label="患者姓名">{patientCase.name || '—'}</Descriptions.Item>
          <Descriptions.Item label="年龄">{patientCase.age ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="既往疾病">
            <ExpandableText text={patientCase.pastHistory || '—'} />
          </Descriptions.Item>
          <Descriptions.Item label="本次问题">
            <ExpandableText text={patientCase.currentProblem || '—'} />
          </Descriptions.Item>
          {hasImageRecognitions && (
            <Descriptions.Item label="图片识别结果">
              <ExpandableText text={patientCase.imageRecognitionResult || '—'} />
            </Descriptions.Item>
          )}
        </Descriptions>

        <DoctorList doctors={doctors} />

        {workflow.phase === 'voting' && (
          <div style={{ marginTop: '16px' }}>
            <VoteTally doctors={doctors} votes={lastRoundVotes} />
          </div>
        )}

        {workflow.phase === 'finished' && (
          <div style={{ marginTop: '16px' }}>
            <Alert type="success" showIcon message="会诊已结束" description={winnerText} />
            <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Button
                type="primary"
                disabled={finalSummary.status !== 'ready'}
                onClick={() => setSummaryOpen(true)}
              >
                查看最终答案
              </Button>
              {finalSummary.status === 'pending' && <Tag color="processing">最终答案生成中...</Tag>}
              {finalSummary.status === 'ready' && (
                <Tag color="success">最终答案已生成 · {finalSummary.doctorName}</Tag>
              )}
              {finalSummary.status === 'error' && <Tag color="error">最终答案生成失败</Tag>}
            </div>
          </div>
        )}

        <div style={{ marginTop: '16px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <Button onClick={onOpenSettings} disabled={isExportingSession}>
            问诊设置
          </Button>
          <Button onClick={exportCurrentSessionAsPDF} loading={isExportingSession} disabled={isExportingSession}>
            📄 导出 PDF
          </Button>
          <Button onClick={exportCurrentSessionAsImage} loading={isExportingSession} disabled={isExportingSession}>
            🖼️ 导出图片
          </Button>
          <Popconfirm title="确认重置流程？" onConfirm={resetAll} disabled={isExportingSession}>
            <Button danger disabled={isExportingSession}>
              重置
            </Button>
          </Popconfirm>
        </div>
      </Card>

      <Modal
        open={summaryOpen}
        onCancel={() => setSummaryOpen(false)}
        title="最终答案"
        width={900}
        footer={null}
      >
        {finalSummary.status === 'ready' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
              <Button type="dashed" size="small" onClick={exportSummaryImage}>
                导出图片
              </Button>
            </div>
            <div ref={exportRef} className="final-card">
              <div className="final-card-header">
                <div className="final-title">🎯 最终答案</div>
                <div className="final-sub">由 {finalSummary.doctorName} 生成</div>
              </div>
              <div className="case-brief">
                <div>患者姓名：{patientCase.name || '—'}</div>
                <div>年龄：{patientCase.age ?? '—'}</div>
                <div>既往疾病：{patientCase.pastHistory || '—'}</div>
                <div>本次问题：{patientCase.currentProblem || '—'}</div>
                {patientCase.imageRecognitionResult && (
                  <div>图片识别结果：{patientCase.imageRecognitionResult}</div>
                )}
              </div>
              <div
                className="final-summary-md"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(finalSummary.content) }}
              />
            </div>
          </div>
        )}
        {finalSummary.status === 'pending' && <Alert type="info" message="最终答案生成中..." showIcon />}
        {finalSummary.status === 'error' && (
          <Alert type="error" message={finalSummary.content} showIcon />
        )}
      </Modal>
    </>
  );
}

export default StatusPanel;
