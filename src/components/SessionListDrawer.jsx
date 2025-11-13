import React, { useMemo, useState } from 'react';
import { Drawer, Button, Table, Tag, Tooltip, Popconfirm, message } from 'antd';
import { useSessionsStore } from '../store/useSessionsStore';
import { useConsultStore } from '../store/useConsultStore';
import { exportSessionAsPDF, exportSessionAsImage } from '../utils/exportSession';
import './SessionListDrawer.css';

function SessionListDrawer({ open, onClose }) {
  const sessions = useSessionsStore();
  const consult = useConsultStore();
  const [exportingId, setExportingId] = useState(null);

  const rows = useMemo(() => {
    return sessions.sessions.map((s) => ({
      ...s,
      current: sessions.currentId === s.id
    }));
  }, [sessions.sessions, sessions.currentId]);

  const onCreate = () => {
    const id = sessions.createNew('新建问诊');
    sessions.switchTo(id);
  };

  const saveNow = () => {
    sessions.saveSnapshotFromConsult();
  };

  const onOpen = (id) => {
    sessions.switchTo(id);
  };

  const onRename = (id) => {
    const name = prompt('请输入新的问诊名称：');
    if (name && name.trim()) sessions.rename(id, name.trim());
  };

  const onDelete = (id) => {
    sessions.remove(id);
  };

  const onExport = (id) => {
    const json = sessions.exportJSON(id);
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${id}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const onExportPDF = async (id) => {
    try {
      setExportingId(id);
      const sessionData = sessions.getSessionData(id);
      const meta = sessions.sessions.find((s) => s.id === id);

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
      setExportingId(null);
    }
  };

  const onExportImage = async (id) => {
    try {
      setExportingId(id);
      const sessionData = sessions.getSessionData(id);
      const meta = sessions.sessions.find((s) => s.id === id);

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
      setExportingId(null);
    }
  };

  const onDeleteCurrent = () => {
    sessions.remove(sessions.currentId);
  };

  const columns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      ellipsis: true,
      render: (text, record) => {
        const displayText = text + (record.current ? '（当前）' : '');
        return (
          <Tooltip placement="topLeft" title={displayText}>
            <span
              style={{
                display: 'inline-block',
                maxWidth: '100%',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
            >
              {displayText}
            </span>
          </Tooltip>
        );
      }
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (text) => {
        const colorMap = { '配置/准备': 'blue', '讨论中': 'green', '评估中': 'orange', '已结束': 'default' };
        const color = colorMap[text] || 'default';
        return <Tag color={color}>{text}</Tag>;
      }
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 170,
      render: (text) => {
        const d = new Date(text);
        if (isNaN(d.getTime())) return text;
        const pad = (n) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
      }
    },
    {
      title: '操作',
      key: 'actions',
      width: 520,
      render: (_, record) => {
        const isCurrent = !!record.current;
        const isExporting = exportingId === record.id;
        return (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <Button type={isCurrent ? 'default' : 'primary'} ghost={isCurrent} size="small" onClick={() => onOpen(record.id)} disabled={isExporting}>
              打开
            </Button>
            <Button size="small" onClick={() => onRename(record.id)} disabled={isExporting}>
              重命名
            </Button>
            <Button type="dashed" size="small" onClick={() => onExport(record.id)} disabled={isExporting}>
              导出 JSON
            </Button>
            <Button size="small" onClick={() => onExportPDF(record.id)} loading={isExporting} disabled={isExporting}>
              📄 导出 PDF
            </Button>
            <Button size="small" onClick={() => onExportImage(record.id)} loading={isExporting} disabled={isExporting}>
              🖼️ 导出图片
            </Button>
            <Popconfirm title="确认删除该问诊？" onConfirm={() => onDelete(record.id)} disabled={isExporting}>
              <Button danger size="small" disabled={isExporting}>
                删除
              </Button>
            </Popconfirm>
          </div>
        );
      }
    }
  ];

  const rowClassName = (record) => {
    return record.current ? 'current-row' : '';
  };

  return (
    <Drawer title="问诊列表" placement="right" open={open} onClose={onClose} width={940}>
      <div style={{ marginBottom: '12px', display: 'flex', gap: '8px' }}>
        <Button type="primary" onClick={onCreate}>新建问诊</Button>
        <Button type="dashed" onClick={saveNow}>保存当前</Button>
        <Popconfirm title="确认删除当前问诊？" onConfirm={onDeleteCurrent}>
          <Button danger>删除当前</Button>
        </Popconfirm>
      </div>
      <Table dataSource={rows} columns={columns} pagination={false} rowKey="id" rowClassName={rowClassName} />
    </Drawer>
  );
}

export default SessionListDrawer;
