import React, { useState, useEffect, useCallback } from 'react';
import { Layout, Button, Row, Col } from 'antd';
import DiscussionPanel from './components/DiscussionPanel';
import StatusPanel from './components/StatusPanel';
import GlobalSettingsModal from './components/GlobalSettingsModal';
import ConsultationSettingsModal from './components/ConsultationSettingsModal';
import SessionListDrawer from './components/SessionListDrawer';
import { useConsultStore } from './store/useConsultStore';
import { useSessionsStore } from './store/useSessionsStore';
import logoUrl from './assets/logo.svg';
import './App.css';

const { Header, Content } = Layout;

function App() {
  const [globalSettingsOpen, setGlobalSettingsOpen] = useState(false);
  const [consultationSettingsOpen, setConsultationSettingsOpen] = useState(false);
  const [sessionsOpen, setSessionsOpen] = useState(false);

  const consultStore = useConsultStore();
  const sessionsStore = useSessionsStore();

  // Initialize sessions on mount
  useEffect(() => {
    sessionsStore.init(useConsultStore.getState());
  }, []);

  // Auto-save on state changes
  useEffect(() => {
    const unsubscribe = useConsultStore.subscribe((state) => {
      setTimeout(() => {
        sessionsStore.saveSnapshotFromConsult(state);
      }, 500);
    });
    return unsubscribe;
  }, [sessionsStore]);

  const handleOpenConsultationSettings = useCallback(() => {
    setConsultationSettingsOpen(true);
  }, []);

  const handleOpenGlobalSettings = useCallback(() => {
    setGlobalSettingsOpen(true);
  }, []);

  useEffect(() => {
    window.addEventListener('open-settings', handleOpenConsultationSettings);
    window.addEventListener('open-global-settings', handleOpenGlobalSettings);
    return () => {
      window.removeEventListener('open-settings', handleOpenConsultationSettings);
      window.removeEventListener('open-global-settings', handleOpenGlobalSettings);
    };
  }, [handleOpenConsultationSettings, handleOpenGlobalSettings]);

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header
        style={{
          background: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          borderBottom: '1px solid #f0f0f0'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <img src={logoUrl} alt="AI 医疗会诊面板 Logo" style={{ width: '28px', height: '28px' }} />
          <span style={{ fontSize: '18px', fontWeight: 600 }}>AI 医疗会诊面板</span>
          <span style={{ fontSize: '18px', fontWeight: 600, color: '#ff4d4f' }}>
            【本内容仅供参考，身体不适尽早就医】
          </span>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Button onClick={() => setSessionsOpen(true)}>问诊列表</Button>
          <Button onClick={() => setGlobalSettingsOpen(true)}>全局设置</Button>
          <Button type="primary" onClick={() => setConsultationSettingsOpen(true)}>
            问诊设置
          </Button>
        </div>
      </Header>
      <Layout>
        <Content style={{ padding: '16px', height: 'calc(100vh - 64px)', overflow: 'hidden' }}>
          <Row gutter={16} align="stretch" style={{ height: '100%' }}>
            <Col span={16} style={{ height: '100%' }}>
              <DiscussionPanel className="discussion-panel-host" />
            </Col>
            <Col span={8} style={{ height: '100%' }}>
              <StatusPanel
                className="status-panel-host"
                onOpenSettings={() => setConsultationSettingsOpen(true)}
              />
            </Col>
          </Row>
        </Content>
      </Layout>
      <GlobalSettingsModal open={globalSettingsOpen} onClose={() => setGlobalSettingsOpen(false)} />
      <ConsultationSettingsModal
        open={consultationSettingsOpen}
        onClose={() => setConsultationSettingsOpen(false)}
      />
      <SessionListDrawer open={sessionsOpen} onClose={() => setSessionsOpen(false)} />
    </Layout>
  );
}

export default App;
