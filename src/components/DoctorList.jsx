import React from 'react';
import { List } from 'antd';

const providerLabelMap = {
  openai: 'OpenAI规范',
  anthropic: 'Anthropic规范',
  gemini: 'Gemini规范',
  siliconflow: '硅基流动',
  modelscope: '魔搭社区'
};

function resolveProviderLabel(value) {
  return providerLabelMap[value] || value;
}

function DoctorList({ doctors = [] }) {
  return (
    <div>
      <div style={{ fontWeight: 600, marginBottom: '8px' }}>医生列表</div>
      <List
        dataSource={doctors}
        renderItem={(item) => {
          const color = item.status === 'active' ? 'green' : 'gray';
          const desc = `${resolveProviderLabel(item.provider)} • ${item.model}`;
          
          return (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '4px 0'
              }}
            >
              <div>
                <span
                  style={{
                    color,
                    textDecoration: item.status === 'eliminated' ? 'line-through' : 'none'
                  }}
                >
                  {item.name}
                </span>
                <div style={{ color: '#8c8c8c', fontSize: '12px' }}>{desc}</div>
              </div>
              <div style={{ color: '#8c8c8c', fontSize: '12px' }}>
                {item.status === 'active' ? '在席' : '不太准确'}
              </div>
            </div>
          );
        }}
      />
    </div>
  );
}

export default DoctorList;
