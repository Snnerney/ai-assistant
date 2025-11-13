import React, { useState, useCallback } from 'react';
import { Alert, Button, Input, Upload, message } from 'antd';
import { useConsultStore } from '../store/useConsultStore';
import { useGlobalStore } from '../store/useGlobalStore';
import CaseInputForm from './CaseInputForm';
import ChatDisplay from './ChatDisplay';
import { recognizeImageWithSiliconFlow } from '../api/imageRecognition';
import './DiscussionPanel.css';

const { Search } = Input;

function DiscussionPanel({ className }) {
  const [input, setInput] = useState('');
  const [isRecognizingImage, setIsRecognizingImage] = useState(false);

  const workflow = useConsultStore((state) => state.workflow);
  const discussionHistory = useConsultStore((state) => state.discussionHistory);
  const addPatientMessage = useConsultStore((state) => state.addPatientMessage);
  const togglePause = useConsultStore((state) => state.togglePause);

  const imageRecognition = useGlobalStore((state) => state.imageRecognition);
  const imageRecognitionEnabled = imageRecognition?.enabled || false;

  const canInput = workflow.phase !== 'setup';

  const phaseText = () => {
    switch (workflow.phase) {
      case 'discussion':
        return '讨论中';
      case 'voting':
        return '评估中';
      case 'finished':
        return '已结束';
      default:
        return workflow.phase;
    }
  };

  const onSend = useCallback(() => {
    const text = input.trim();
    if (!text) return;
    addPatientMessage(text);
    setInput('');
  }, [input, addPatientMessage]);

  const toBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const full = reader.result;
        let raw = '';
        if (typeof full === 'string') {
          const parts = full.split(',');
          raw = parts.length > 1 ? parts[1] : parts[0];
        }
        resolve({ full, raw });
      };
      reader.onerror = (e) => reject(e);
      reader.readAsDataURL(file);
    });
  };

  const handleImageUpload = async (file) => {
    if (!imageRecognitionEnabled) {
      message.warning('请先在设置中启用图像识别功能');
      return false;
    }

    setIsRecognizingImage(true);

    try {
      const base64 = await toBase64(file);

      const result = await recognizeImageWithSiliconFlow({
        apiKey: imageRecognition.apiKey,
        baseUrl: imageRecognition.baseUrl,
        model: imageRecognition.model,
        prompt: imageRecognition.prompt,
        imageBase64: base64.raw
      });

      const trimmed = (result || '').trim();

      if (trimmed) {
        setInput(trimmed);
        // Auto send after a small delay
        setTimeout(() => {
          addPatientMessage(trimmed);
          setInput('');
        }, 100);
      } else {
        message.warning('图片识别未返回内容');
      }
    } catch (err) {
      const errorMessage = err?.message || '图片识别失败，请检查配置';
      message.error(errorMessage);
    } finally {
      setIsRecognizingImage(false);
    }

    return false;
  };

  if (workflow.phase === 'setup') {
    return (
      <div className={className}>
        <CaseInputForm />
      </div>
    );
  }

  return (
    <div className={`discussion-panel discussion-panel--chat ${className}`}>
      <div className="chat-wrapper">
        <div className="controls">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ color: '#8c8c8c', fontSize: '12px' }}>
              当前阶段：{phaseText()}
            </div>
            <div>
              {workflow.phase === 'discussion' && (
                <Button
                  size="small"
                  type={workflow.paused ? 'primary' : 'default'}
                  danger={!workflow.paused}
                  onClick={togglePause}
                >
                  {workflow.paused ? '▶️ 继续' : '⏸️ 暂停'}
                </Button>
              )}
            </div>
          </div>
        </div>

        {workflow.phase === 'discussion' && workflow.paused && (
          <Alert
            type="warning"
            showIcon
            closable
            className="pause-banner"
            onClose={togglePause}
            message={
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
                <span style={{ fontSize: '16px' }}>⏸️</span>
                <span>会诊已暂停</span>
              </div>
            }
            description='点击右侧"继续"按钮或关闭此提示以恢复会诊进程'
          />
        )}

        <ChatDisplay className="chat-scroll-area" history={discussionHistory} activeId={workflow.activeTurn} />

        <div className="chat-input">
          <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
            {imageRecognitionEnabled && (
              <Upload
                beforeUpload={handleImageUpload}
                showUploadList={false}
                accept="image/*"
                disabled={!canInput || isRecognizingImage}
              >
                <Button loading={isRecognizingImage} disabled={!canInput || isRecognizingImage}>
                  <span>📷</span>
                </Button>
              </Upload>
            )}
            <Search
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="我想补充一些情况，按回车发送..."
              enterButton="发送"
              disabled={!canInput || isRecognizingImage}
              onSearch={onSend}
              style={{ flex: 1 }}
            />
          </div>
          {imageRecognitionEnabled && isRecognizingImage && (
            <div className="upload-hint">
              <span>正在识别图片...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default DiscussionPanel;
