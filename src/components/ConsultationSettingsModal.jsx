import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Modal, Tabs, Alert, Space, Button, Form, Input, Select, InputNumber, Radio, List, Popconfirm, message } from 'antd';
import { useConsultStore } from '../store/useConsultStore';
import { useGlobalStore } from '../store/useGlobalStore';
import { useSessionsStore } from '../store/useSessionsStore';

const { TextArea } = Input;
const { TabPane } = Tabs;

function ConsultationSettingsModal({ open, onClose }) {
  const consult = useConsultStore();
  const global = useGlobalStore();
  const sessions = useSessionsStore();

  const [localConsultationName, setLocalConsultationName] = useState('');
  const [localSettings, setLocalSettings] = useState({});
  const [consultDoctors, setConsultDoctors] = useState([]);
  const [linkedConsultations, setLinkedConsultations] = useState([]);
  const [selectedToAdd, setSelectedToAdd] = useState(null);
  const [selectedLinkedIds, setSelectedLinkedIds] = useState([]);
  const [previousValidLinkedIds, setPreviousValidLinkedIds] = useState([]);

  useEffect(() => {
    if (open) {
      setLocalConsultationName(consult.consultationName || '');
      setLocalSettings(JSON.parse(JSON.stringify(consult.settings)));
      setConsultDoctors(JSON.parse(JSON.stringify(consult.doctors)));
      setLinkedConsultations(JSON.parse(JSON.stringify(consult.linkedConsultations || [])));
      setSelectedToAdd(null);
      const ids = (consult.linkedConsultations || []).map((item) => item.sourceId || item.id?.replace(/^linked-/, '') || item.id);
      setSelectedLinkedIds(ids);
      setPreviousValidLinkedIds([...ids]);
    }
  }, [open, consult.consultationName, consult.settings, consult.doctors, consult.linkedConsultations]);

  const providerOptionsMap = useMemo(() => {
    const map = {};
    const options = [
      { label: 'OpenAI规范', value: 'openai' },
      { label: 'Anthropic规范', value: 'anthropic' },
      { label: 'Gemini规范', value: 'gemini' },
      { label: '硅基流动', value: 'siliconflow' },
      { label: '魔搭社区', value: 'modelscope' }
    ];
    options.forEach((item) => {
      map[item.value] = item.label;
    });
    return map;
  }, []);

  const globalDoctorOptions = useMemo(() => {
    const included = new Set((consultDoctors || []).map((d) => d.id));
    return (global.doctors || [])
      .filter((d) => !included.has(d.id))
      .map((d) => ({ label: `${d.name}（${providerOptionsMap[d.provider] || d.provider}•${d.model}）`, value: d.id }));
  }, [consultDoctors, global.doctors, providerOptionsMap]);

  const isValidDoctor = useCallback((doctor) => {
    return doctor && doctor.apiKey && doctor.apiKey.trim() && doctor.model && doctor.model.trim();
  }, []);

  const addToConsult = useCallback(() => {
    const targetId = selectedToAdd;
    if (!targetId) return;
    const d = (global.doctors || []).find((x) => x.id === targetId);
    if (!d) return;

    if (!isValidDoctor(d)) {
      message.error(`医生"${d.name}"未配置API Key或模型，请先去全局设置中配置。`);
      return;
    }

    setConsultDoctors((prev) => [...prev, { ...d, status: 'active', votes: 0 }]);
    setSelectedToAdd(null);
  }, [selectedToAdd, global.doctors, isValidDoctor]);

  const addAllToConsult = useCallback(() => {
    const included = new Set((consultDoctors || []).map((d) => d.id));
    const toAdd = (global.doctors || []).filter((d) => !included.has(d.id));

    const validDoctors = toAdd.filter((d) => isValidDoctor(d));
    const invalidDoctors = toAdd.filter((d) => !isValidDoctor(d));

    if (invalidDoctors.length > 0) {
      const invalidNames = invalidDoctors.map((d) => d.name).join('、');
      message.error(`以下医生未配置API Key或模型，无法添加：${invalidNames}。请先去全局设置中配置。`);
    }

    if (validDoctors.length > 0) {
      setConsultDoctors((prev) => [...prev, ...validDoctors.map((d) => ({ ...d, status: 'active', votes: 0 }))]);
    }
  }, [consultDoctors, global.doctors, isValidDoctor]);

  const clearConsultDoctors = useCallback(() => {
    setConsultDoctors([]);
  }, []);

  const removeConsultDoctor = useCallback((id) => {
    setConsultDoctors((prev) => prev.filter((d) => d.id !== id));
  }, []);

  const formatDateTime = useCallback((value) => {
    if (!value) return '未知时间';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    const pad = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }, []);

  const previewText = useCallback((text, maxLength = 80) => {
    if (!text) return '无';
    const normalized = String(text).replace(/\s+/g, ' ').trim();
    if (!normalized) return '无';
    return normalized.length > maxLength ? `${normalized.slice(0, maxLength)}…` : normalized;
  }, []);

  const finishedConsultationOptions = useMemo(() => {
    const currentId = sessions.currentId;
    return sessions.sessions
      .filter((s) => s.status === '已结束' && s.id !== currentId)
      .map((s) => ({
        label: `${s.name}（${formatDateTime(s.updatedAt)}）`,
        value: s.id
      }));
  }, [sessions.sessions, sessions.currentId, formatDateTime]);

  const handleLinkedChange = useCallback((selectedIds) => {
    if (!selectedIds || !selectedIds.length) {
      setLinkedConsultations([]);
      setPreviousValidLinkedIds([]);
      return;
    }

    const ids = Array.isArray(selectedIds) ? [...selectedIds] : [];
    const newLinked = [];
    const genderMap = { male: '男', female: '女', other: '其他' };

    for (const id of ids) {
      const data = sessions.getSessionData(id);
      if (!data) {
        message.error('读取关联问诊数据失败，请确认该问诊已保存。');
        setSelectedLinkedIds([...previousValidLinkedIds]);
        return;
      }

      const sessionMeta = sessions.sessions.find((s) => s.id === id);
      const consultName = sessionMeta?.name || data?.consultationName || '未命名问诊';
      const patientCase = data?.patientCase || {};
      const patientName = patientCase.name || '';
      const patientGender = patientCase.gender || '';
      const patientAge = patientCase.age;
      const pastHistory = patientCase.pastHistory || '';
      const currentProblem = patientCase.currentProblem || '';
      const imageRecognitionResult = patientCase.imageRecognitionResult || '';
      const finalSummary = data?.finalSummary?.content || '';
      const finishedAt = sessionMeta?.updatedAt || '';

      newLinked.push({
        id: `linked-${id}`,
        sourceId: id,
        consultationName: consultName,
        patientName,
        patientGender,
        patientAge,
        pastHistory,
        currentProblem,
        imageRecognitionResult,
        finalSummary,
        finishedAt,
        metadata: { sessionMeta, patientCase }
      });
    }

    if (newLinked.length === 0) {
      setLinkedConsultations([]);
      setPreviousValidLinkedIds([]);
      return;
    }

    const firstPatient = newLinked[0];
    const firstName = firstPatient.patientName || '';
    const firstGender = firstPatient.patientGender || '';
    const firstAge = firstPatient.patientAge;

    for (let i = 1; i < newLinked.length; i++) {
      const item = newLinked[i];
      const name = item.patientName || '';
      const gender = item.patientGender || '';
      const age = item.patientAge;

      if (name !== firstName || gender !== firstGender || age !== firstAge) {
        const firstAgeStr = firstAge !== null && firstAge !== undefined ? `${firstAge}岁` : '未知';
        const itemAgeStr = age !== null && age !== undefined ? `${age}岁` : '未知';
        message.error(`无法添加：多选的问诊必须具有相同的患者名称、性别、年龄。\n第1个：${firstName || '未知'}，${genderMap[firstGender] || firstGender || '未知'}，${firstAgeStr}\n第${i + 1}个：${name || '未知'}，${genderMap[gender] || gender || '未知'}，${itemAgeStr}`);
        setSelectedLinkedIds([...previousValidLinkedIds]);
        return;
      }
    }

    setLinkedConsultations(newLinked);
    setPreviousValidLinkedIds([...ids]);
  }, [sessions, previousValidLinkedIds]);

  const clearLinkedConsultations = useCallback(() => {
    setLinkedConsultations([]);
    setSelectedLinkedIds([]);
    setPreviousValidLinkedIds([]);
  }, []);

  const removeLinkedConsultation = useCallback((id) => {
    const target = linkedConsultations.find((item) => item.id === id);
    setLinkedConsultations((prev) => prev.filter((item) => item.id !== id));
    const sourceId = target?.sourceId || id.replace(/^linked-/, '');
    const newIds = selectedLinkedIds.filter((sid) => sid !== sourceId);
    setSelectedLinkedIds(newIds);
    handleLinkedChange(newIds);
  }, [linkedConsultations, selectedLinkedIds, handleLinkedChange]);

  const handleSave = useCallback(() => {
    consult.setConsultationName(localConsultationName);
    consult.setSettings(localSettings);
    consult.setDoctors(consultDoctors);
    consult.setLinkedConsultations(linkedConsultations);
    if (localConsultationName.trim() && sessions.currentId) {
      sessions.rename(sessions.currentId, localConsultationName.trim());
    }
    message.success('已保存问诊设置');
    onClose();
  }, [localConsultationName, localSettings, consultDoctors, linkedConsultations, consult, sessions, onClose]);

  const genderMap = { male: '男', female: '女', other: '其他' };

  return (
    <Modal open={open} onCancel={onClose} onOk={handleSave} title="问诊设置" width={900} okText="保存">
      <Tabs>
        <TabPane tab="问诊参数" key="consultSettings">
          <Form layout="vertical">
            <Alert type="info" showIcon message="问诊参数" description="配置当前问诊的名称与提示词。" style={{ marginBottom: '16px' }} />
            <Form.Item label="问诊名称">
              <Input value={localConsultationName} onChange={(e) => setLocalConsultationName(e.target.value)} placeholder="请输入问诊名称" />
            </Form.Item>
            <Form.Item label="当前会诊系统提示词">
              <TextArea value={localSettings.globalSystemPrompt} onChange={(e) => setLocalSettings((prev) => ({ ...prev, globalSystemPrompt: e.target.value }))} rows={6} />
            </Form.Item>
            <Form.Item label="最终总结提示词">
              <TextArea value={localSettings.summaryPrompt} onChange={(e) => setLocalSettings((prev) => ({ ...prev, summaryPrompt: e.target.value }))} rows={6} />
            </Form.Item>
            <Form.Item label="发言顺序">
              <Radio.Group value={localSettings.turnOrder} onChange={(e) => setLocalSettings((prev) => ({ ...prev, turnOrder: e.target.value }))}>
                <Radio value="random">随机</Radio>
                <Radio value="custom">自定义（按医生列表顺序）</Radio>
              </Radio.Group>
            </Form.Item>
            <Form.Item label="连续未标注不太准确的最大轮数">
              <InputNumber value={localSettings.maxRoundsWithoutElimination} onChange={(value) => setLocalSettings((prev) => ({ ...prev, maxRoundsWithoutElimination: value }))} min={1} />
            </Form.Item>
          </Form>
        </TabPane>
        <TabPane tab="问诊医生" key="consultDoctors">
          <Space direction="vertical" style={{ width: '100%' }}>
            <Alert type="info" showIcon message="当前问诊医生" description='从全局配置中选择医生加入本次问诊。"在席/不太准确"状态仅属于当前问诊。' />
            <div style={{ display: 'flex', gap: '8px' }}>
              <Select value={selectedToAdd} onChange={setSelectedToAdd} options={globalDoctorOptions} style={{ flex: 1 }} placeholder="选择要添加的医生" />
              <Button type="primary" onClick={addToConsult}>添加</Button>
              <Button onClick={addAllToConsult}>添加全部</Button>
              <Popconfirm title="确认清空当前问诊医生？" onConfirm={clearConsultDoctors}>
                <Button danger>清空</Button>
              </Popconfirm>
            </div>
            <List
              dataSource={consultDoctors}
              renderItem={(item) => (
                <List.Item
                  actions={[<Button key="remove" type="link" danger onClick={() => removeConsultDoctor(item.id)}>移除</Button>]}
                >
                  <List.Item.Meta
                    title={item.name}
                    description={`${providerOptionsMap[item.provider] || item.provider} • ${item.model}`}
                  />
                </List.Item>
              )}
            />
          </Space>
        </TabPane>
        <TabPane tab="关联问诊" key="linkedConsultations">
          <Space direction="vertical" style={{ width: '100%' }}>
            <Alert type="info" showIcon message="关联问诊" description="可以从已结束的问诊中选择关联问诊，作为医生诊断的参考上下文。多选的问诊必须具有相同的患者名称、性别、年龄。" />
            <div style={{ display: 'flex', gap: '8px' }}>
              <Select
                mode="multiple"
                value={selectedLinkedIds}
                onChange={(ids) => {
                  setSelectedLinkedIds(ids);
                  handleLinkedChange(ids);
                }}
                options={finishedConsultationOptions}
                style={{ flex: 1 }}
                placeholder="选择已结束的问诊（可多选）"
                showSearch
                filterOption={(input, option) => option.label.toLowerCase().includes(input.toLowerCase())}
              />
              <Popconfirm title="确认清空关联问诊？" onConfirm={clearLinkedConsultations}>
                <Button danger>清空</Button>
              </Popconfirm>
            </div>
            {linkedConsultations.length > 0 ? (
              <div style={{ marginTop: '12px' }}>
                <List
                  dataSource={linkedConsultations}
                  renderItem={(item) => {
                    const patientInfo = [
                      item.patientName || '未知',
                      genderMap[item.patientGender] || item.patientGender || '未知',
                      item.patientAge !== null && item.patientAge !== undefined ? `${item.patientAge}岁` : '年龄未知'
                    ].join('，');

                    return (
                      <List.Item
                        actions={[<Button key="remove" type="link" danger size="small" onClick={() => removeLinkedConsultation(item.id)}>移除</Button>]}
                      >
                        <List.Item.Meta
                          title={item.consultationName}
                          description={
                            <div style={{ fontSize: '12px' }}>
                              <div style={{ color: '#595959', marginBottom: '4px' }}>患者：{patientInfo}</div>
                              <div style={{ color: '#8c8c8c' }}>既往疾病：{previewText(item.pastHistory, 60)}</div>
                              <div style={{ color: '#8c8c8c' }}>本次问题：{previewText(item.currentProblem, 60)}</div>
                              <div style={{ color: '#8c8c8c' }}>图片识别：{previewText(item.imageRecognitionResult, 60)}</div>
                              <div style={{ color: '#8c8c8c' }}>最终答案：{previewText(item.finalSummary, 80)}</div>
                              {item.finishedAt && <div style={{ color: '#bfbfbf', marginTop: '4px' }}>完成：{formatDateTime(item.finishedAt)}</div>}
                            </div>
                          }
                        />
                      </List.Item>
                    );
                  }}
                />
              </div>
            ) : (
              <div style={{ color: '#8c8c8c', textAlign: 'center', padding: '20px' }}>暂无关联问诊</div>
            )}
          </Space>
        </TabPane>
      </Tabs>
    </Modal>
  );
}

export default ConsultationSettingsModal;
