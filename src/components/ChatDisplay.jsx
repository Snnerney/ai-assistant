import React, { useRef, useEffect } from 'react';
import { marked } from 'marked';
import './ChatDisplay.css';

const doctorPalette = [
  { avatar: '#2f54eb', bubble: '#f0f5ff', border: '#adc6ff', name: '#1d39c4' },
  { avatar: '#08979c', bubble: '#e6fffb', border: '#87e8de', name: '#006d75' },
  { avatar: '#d46b08', bubble: '#fff7e6', border: '#ffd591', name: '#ad4e00' },
  { avatar: '#531dab', bubble: '#f9f0ff', border: '#d3adf7', name: '#391085' },
  { avatar: '#237804', bubble: '#f6ffed', border: '#b7eb8f', name: '#1a4f08' },
  { avatar: '#a8071a', bubble: '#fff1f0', border: '#ffccc7', name: '#820014' }
];

function paletteIndex(doctorId) {
  const str = doctorId || '';
  if (!str) return 0;
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash * 31 + str.charCodeAt(i)) & 0xffffffff;
  }
  return Math.abs(hash) % doctorPalette.length;
}

function getDoctorTheme(doctorId) {
  return doctorPalette[paletteIndex(doctorId)];
}

function renderMarkdown(text) {
  try {
    return marked.parse(text || '');
  } catch (e) {
    return text;
  }
}

function initials(name) {
  if (!name) return 'Dr';
  return name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .toUpperCase();
}

function ChatDisplay({ history = [], activeId = null }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [history]);

  return (
    <div ref={containerRef} className="chat-display">
      {history.map((item, idx) => (
        <div key={idx} className="chat-item fade-in">
          {item.type === 'system' && (
            <div className="system-msg">{item.content}</div>
          )}
          
          {item.type === 'doctor' && (
            <div className="doctor-msg">
              <div
                className="avatar"
                style={{ background: getDoctorTheme(item.doctorId).avatar }}
              >
                {initials(item.doctorName)}
              </div>
              <div
                className="bubble doctor"
                style={{
                  background: getDoctorTheme(item.doctorId).bubble,
                  borderColor: getDoctorTheme(item.doctorId).border
                }}
              >
                <div
                  className="name"
                  style={{ color: getDoctorTheme(item.doctorId).name }}
                >
                  {item.doctorName}
                </div>
                <div
                  className="content"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(item.content) }}
                />
              </div>
            </div>
          )}
          
          {item.type === 'patient' && (
            <div className="patient-msg">
              <div className="bubble patient">
                <div className="name">{item.author || '患者'}</div>
                <div
                  className="content"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(item.content) }}
                />
              </div>
              <div className="avatar patient">患</div>
            </div>
          )}
          
          {item.type === 'vote_detail' && (
            <div className="vote-detail">
              <span className="badge">评估</span>
              <span className="text">
                {item.voterName} 标注 {item.targetName} 为不太准确：{item.reason}
              </span>
            </div>
          )}
          
          {item.type === 'vote_result' && (
            <div className="system-msg vote">{item.content}</div>
          )}
        </div>
      ))}
    </div>
  );
}

export default ChatDisplay;
