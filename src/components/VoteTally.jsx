import React from 'react';
import { Table, List } from 'antd';

function VoteTally({ doctors = [], votes = [] }) {
  const columns = [
    { title: '医生', dataIndex: 'name', key: 'name' },
    { title: '标记数', dataIndex: 'votes', key: 'votes', width: 80 }
  ];

  return (
    <div>
      <div style={{ fontWeight: 600, marginBottom: '8px' }}>标记统计</div>
      <Table
        pagination={false}
        dataSource={doctors}
        columns={columns}
        size="small"
        rowKey="id"
      />

      {votes && votes.length > 0 && (
        <div style={{ marginTop: '12px' }}>
          <div style={{ fontWeight: 600, marginBottom: '6px' }}>标记详情</div>
          <List
            dataSource={votes}
            size="small"
            renderItem={(item) => (
              <div style={{ fontSize: '12px', color: '#8c8c8c' }}>
                {item.voterName} → {item.targetName}：{item.reason}
              </div>
            )}
          />
        </div>
      )}
    </div>
  );
}

export default VoteTally;
