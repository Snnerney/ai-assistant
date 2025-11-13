import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Modal, Tabs, Alert, Space, Card, Button, Form, Input, Select, Row, Col, InputNumber, Radio, Upload, Checkbox, message, Popconfirm } from 'antd';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useConsultStore } from '../store/useConsultStore';
import { useGlobalStore } from '../store/useGlobalStore';
import { listModels } from '../api/models';
import { recognizeImageWithSiliconFlow } from '../api/imageRecognition';
import './GlobalSettingsModal.css';

const { TextArea } = Input;
const { TabPane } = Tabs;

// Sortable doctor card
function SortableDoctorCard({ doctor, index, onRemove, onUpdate, modelOptions, loadingModel, onLoadModels, presetPromptOptions, onPresetSelect, selectedPreset }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: doctor.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  const providerOptions = [
    { label: 'OpenAI规范', value: 'openai' },
    { label: 'Anthropic规范', value: 'anthropic' },
    { label: 'Gemini规范', value: 'gemini' },
    { label: '硅基流动', value: 'siliconflow' },
    { label: '魔搭社区', value: 'modelscope' }
  ];

  return (
    <div ref={setNodeRef} style={style}>
      <Card
        title={doctor.name || '未命名医生'}
        size="small"
        extra={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span {...attributes} {...listeners} className="drag-handle" title="拖动排序">⋮⋮</span>
            <Button type="link" danger onClick={() => onRemove(index)}>删除</Button>
          </div>
        }
        style={{ marginBottom: '8px' }}
      >
        <Row gutter={8}>
          <Col span={6}>
            <Form.Item label="医生名称">
              <Input value={doctor.name} onChange={(e) => onUpdate(index, 'name', e.target.value)} placeholder="Dr. GPT-4" />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item label="供应商">
              <Select value={doctor.provider} onChange={(value) => onUpdate(index, 'provider', value)} options={providerOptions} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item label="API Key">
              <Input.Password value={doctor.apiKey} onChange={(e) => onUpdate(index, 'apiKey', e.target.value)} placeholder="sk-..." />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item label="自定义 Base URL">
              <Input value={doctor.baseUrl} onChange={(e) => onUpdate(index, 'baseUrl', e.target.value)} placeholder="留空使用默认" />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={8}>
          <Col span={12}>
            <Form.Item label="模型名称（可手动输入）">
              <Input value={doctor.model} onChange={(e) => onUpdate(index, 'model', e.target.value)} placeholder="gpt-4o-mini / claude-3-haiku-20240307 / gemini-1.5-flash" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="选择模型">
              <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                <Select
                  className="model-select"
                  style={{ flex: 1, minWidth: 0 }}
                  value={doctor.model}
                  onChange={(value) => onUpdate(index, 'model', value)}
                  options={modelOptions[doctor.id] || []}
                  showSearch
                  loading={loadingModel[doctor.id]}
                  placeholder="点击右侧按钮加载模型列表"
                  dropdownMatchSelectWidth={false}
                />
                <Button loading={loadingModel[doctor.id]} style={{ flexShrink: 0 }} onClick={() => onLoadModels(doctor)}>加载模型</Button>
              </div>
            </Form.Item>
          </Col>
        </Row>
        <Form.Item label="自定义提示词（可选）">
          <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
            <Select
              value={selectedPreset[doctor.id]}
              onChange={(value) => onPresetSelect(doctor, value)}
              options={presetPromptOptions}
              style={{ flex: 1 }}
              placeholder="选择预设提示词"
              allowClear
            />
          </div>
          <TextArea value={doctor.customPrompt} onChange={(e) => onUpdate(index, 'customPrompt', e.target.value)} rows={2} placeholder="可手动输入或选择上方预设提示词" />
        </Form.Item>
      </Card>
    </div>
  );
}

// Sortable preset card
function SortablePresetCard({ preset, index, onRemove, onUpdate }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: preset.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div ref={setNodeRef} style={style}>
      <Card
        title={preset.name || '未命名预设'}
        size="small"
        extra={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span {...attributes} {...listeners} className="drag-handle" title="拖动排序">⋮⋮</span>
            <Popconfirm title="确认删除此预设？" onConfirm={() => onRemove(index)}>
              <Button type="link" danger>删除</Button>
            </Popconfirm>
          </div>
        }
        style={{ marginBottom: '8px' }}
      >
        <Form layout="vertical">
          <Form.Item label="预设名称">
            <Input value={preset.name} onChange={(e) => onUpdate(index, 'name', e.target.value)} placeholder="如：心血管内科医生" />
          </Form.Item>
          <Form.Item label="提示词内容">
            <TextArea value={preset.prompt} onChange={(e) => onUpdate(index, 'prompt', e.target.value)} rows={4} placeholder="撰写该科室医生的提示词" />
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}

function GlobalSettingsModal({ open, onClose }) {
  const consult = useConsultStore();
  const global = useGlobalStore();

  const [localDoctors, setLocalDoctors] = useState([]);
  const [localSettings, setLocalSettings] = useState({});
  const [localImageRecognition, setLocalImageRecognition] = useState({});
  const [localPresetPrompts, setLocalPresetPrompts] = useState([]);
  const [selectedPreset, setSelectedPreset] = useState({});
  const [modelOptions, setModelOptions] = useState({});
  const [loadingModel, setLoadingModel] = useState({});
  const [imageModelOptions, setImageModelOptions] = useState([]);
  const [loadingImageModel, setLoadingImageModel] = useState(false);
  const [testingImageAPI, setTestingImageAPI] = useState(false);
  const [testImage, setTestImage] = useState(null);
  const [exportSelection, setExportSelection] = useState([]);

  useEffect(() => {
    if (open) {
      setLocalDoctors(JSON.parse(JSON.stringify(global.doctors)));
      setLocalSettings(JSON.parse(JSON.stringify(consult.settings)));
      setLocalImageRecognition({ maxConcurrent: 1, ...JSON.parse(JSON.stringify(global.imageRecognition || {})) });
      setLocalPresetPrompts(JSON.parse(JSON.stringify(global.presetPrompts || [])));
      setSelectedPreset({});
      setImageModelOptions([]);
      setLoadingImageModel(false);
      setTestingImageAPI(false);
      setTestImage(null);
      setExportSelection([]);
    }
  }, [open, global.doctors, global.imageRecognition, global.presetPrompts, consult.settings]);

  const presetPromptOptions = useMemo(() => {
    return (localPresetPrompts || []).map((p) => ({ label: p.name || '未命名预设', value: p.id }));
  }, [localPresetPrompts]);

  const addDoctor = useCallback(() => {
    const id = `doc-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`;
    setLocalDoctors((prev) => [...prev, { id, name: '', provider: 'openai', model: 'gpt-4o-mini', apiKey: '', baseUrl: '', customPrompt: '' }]);
  }, []);

  const removeDoctor = useCallback((idx) => {
    setLocalDoctors((prev) => {
      const target = prev[idx];
      if (target) {
        setSelectedPreset((sp) => {
          const copy = { ...sp };
          delete copy[target.id];
          return copy;
        });
      }
      return prev.filter((_, i) => i !== idx);
    });
  }, []);

  const updateDoctor = useCallback((idx, field, value) => {
    setLocalDoctors((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: value };
      return copy;
    });
  }, []);

  const handlePresetSelect = useCallback((doctor, presetId) => {
    if (!presetId) {
      setSelectedPreset((sp) => {
        const copy = { ...sp };
        delete copy[doctor?.id];
        return copy;
      });
      return;
    }
    const preset = (localPresetPrompts || []).find((p) => p.id === presetId);
    if (!preset) {
      message.warning('所选预设不存在');
      return;
    }
    setLocalDoctors((prev) => prev.map((d) => (d.id === doctor.id ? { ...d, customPrompt: preset.prompt || '' } : d)));
    message.success(`已应用预设提示词：${preset.name || '未命名预设'}`);
    setSelectedPreset((sp) => {
      const copy = { ...sp };
      delete copy[doctor.id];
      return copy;
    });
  }, [localPresetPrompts]);

  const addPreset = useCallback(() => {
    const id = `preset-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`;
    setLocalPresetPrompts((prev) => [...prev, { id, name: '', prompt: '' }]);
  }, []);

  const removePreset = useCallback((idx) => {
    setLocalPresetPrompts((prev) => {
      const removed = prev[idx];
      const newPresets = prev.filter((_, i) => i !== idx);
      if (removed) {
        setSelectedPreset((sp) => {
          const copy = { ...sp };
          Object.keys(copy).forEach((doctorId) => {
            if (copy[doctorId] === removed.id) {
              delete copy[doctorId];
            }
          });
          return copy;
        });
      }
      return newPresets;
    });
  }, []);

  const updatePreset = useCallback((idx, field, value) => {
    setLocalPresetPrompts((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: value };
      return copy;
    });
  }, []);

  const loadModels = useCallback(async (element) => {
    const id = element.id;
    setLoadingModel((prev) => ({ ...prev, [id]: true }));
    try {
      const options = await listModels(element.provider, element.apiKey, element.baseUrl);
      setModelOptions((prev) => ({ ...prev, [id]: options }));
      message.success('模型列表已加载');
    } catch (e) {
      message.error(`加载模型失败：${e?.message || e}`);
    } finally {
      setLoadingModel((prev) => ({ ...prev, [id]: false }));
    }
  }, []);

  const loadImageModels = useCallback(async () => {
    if (!localImageRecognition.apiKey) {
      message.warning('请先填写 API Key');
      return;
    }
    setLoadingImageModel(true);
    try {
      const options = await listModels(localImageRecognition.provider, localImageRecognition.apiKey, localImageRecognition.baseUrl);
      setImageModelOptions(options);
      message.success('图像识别模型列表已加载');
    } catch (e) {
      message.error(`加载图像识别模型失败：${e?.message || e}`);
    } finally {
      setLoadingImageModel(false);
    }
  }, [localImageRecognition]);

  const handleTestImageUpload = useCallback((file) => {
    try {
      const reader = new FileReader();
      reader.onload = (e) => {
        const fullData = e.target.result;
        let base64Only = '';
        if (typeof fullData === 'string') {
          const parts = fullData.split(',');
          base64Only = parts.length > 1 ? parts[1] : parts[0];
        }
        setTestImage({ name: file.name, preview: fullData, base64: base64Only });
        message.success(`已选择测试图片：${file.name}`);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      message.error('读取图片失败');
    }
    return false;
  }, []);

  const removeTestImage = useCallback(() => {
    setTestImage(null);
  }, []);

  const testImageAPI = useCallback(async () => {
    if (!localImageRecognition.apiKey) {
      message.warning('请先填写 API Key');
      return;
    }
    if (!localImageRecognition.model) {
      message.warning('请先选择模型');
      return;
    }
    setTestingImageAPI(true);
    try {
      const defaultTestImage = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      const imageBase64 = testImage?.base64 || defaultTestImage;
      const result = await recognizeImageWithSiliconFlow({
        apiKey: localImageRecognition.apiKey,
        baseUrl: localImageRecognition.baseUrl,
        model: localImageRecognition.model,
        prompt: localImageRecognition.prompt || '请描述这张图片',
        imageBase64
      });
      message.success(`API 测试成功，识别结果：${result}`, 5);
    } catch (e) {
      message.error(`API 测试失败：${e?.message || e}`);
    } finally {
      setTestingImageAPI(false);
    }
  }, [localImageRecognition, testImage]);

  const handleExport = useCallback(() => {
    if (exportSelection.length === 0) {
      message.warning('请至少选择一项要导出的配置');
      return;
    }

    const exportData = {};
    if (exportSelection.includes('doctors')) exportData.doctors = localDoctors;
    if (exportSelection.includes('presetPrompts')) exportData.presetPrompts = localPresetPrompts;
    if (exportSelection.includes('settings')) exportData.settings = localSettings;
    if (exportSelection.includes('imageRecognition')) exportData.imageRecognition = localImageRecognition;

    const jsonStr = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    link.download = `settings-export-${timestamp}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    message.success('设置已导出');
  }, [exportSelection, localDoctors, localPresetPrompts, localSettings, localImageRecognition]);

  const handleImport = useCallback((file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target.result;
        const importData = JSON.parse(content);
        let importedItems = [];

        if (importData.doctors) {
          setLocalDoctors(JSON.parse(JSON.stringify(importData.doctors)));
          importedItems.push('医生配置');
        }
        if (importData.presetPrompts) {
          setLocalPresetPrompts(JSON.parse(JSON.stringify(importData.presetPrompts)));
          importedItems.push('医生预设提示词');
        }
        if (importData.settings) {
          setLocalSettings((prev) => ({ ...prev, ...importData.settings }));
          importedItems.push('全局设置');
        }
        if (importData.imageRecognition) {
          setLocalImageRecognition({ maxConcurrent: 1, ...JSON.parse(JSON.stringify(importData.imageRecognition)) });
          importedItems.push('图片识别');
        }

        if (importedItems.length > 0) {
          message.success(`已导入：${importedItems.join('、')}`);
        } else {
          message.warning('导入文件中没有可识别的配置项');
        }
      } catch (err) {
        message.error('导入失败：文件格式不正确或内容无效');
      }
    };
    reader.onerror = () => {
      message.error('读取文件失败');
    };
    reader.readAsText(file);
    return false;
  }, []);

  const handleSave = useCallback(() => {
    global.setDoctors(localDoctors);
    global.setPresetPrompts(localPresetPrompts);
    global.setImageRecognition(localImageRecognition);
    consult.setSettings(localSettings);
    message.success('已保存全局设置');
    onClose();
  }, [localDoctors, localPresetPrompts, localImageRecognition, localSettings, global, consult, onClose]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDoctorDragEnd = (event) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setLocalDoctors((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const handlePresetDragEnd = (event) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setLocalPresetPrompts((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  return (
    <Modal open={open} onCancel={onClose} onOk={handleSave} title="全局设置" width={900} okText="保存">
      <Tabs>
        <TabPane tab="医生配置" key="doctors">
          <Space direction="vertical" style={{ width: '100%' }}>
            <Alert type="info" showIcon message="提示" description="可添加多个由不同 LLM 驱动的医生。未填写 API Key 将使用模拟回复。" />
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDoctorDragEnd}>
              <SortableContext items={localDoctors.map((d) => d.id)} strategy={verticalListSortingStrategy}>
                {localDoctors.map((doctor, index) => (
                  <SortableDoctorCard
                    key={doctor.id}
                    doctor={doctor}
                    index={index}
                    onRemove={removeDoctor}
                    onUpdate={updateDoctor}
                    modelOptions={modelOptions}
                    loadingModel={loadingModel}
                    onLoadModels={loadModels}
                    presetPromptOptions={presetPromptOptions}
                    onPresetSelect={handlePresetSelect}
                    selectedPreset={selectedPreset}
                  />
                ))}
              </SortableContext>
            </DndContext>
            <Button type="dashed" block onClick={addDoctor}>+ 添加医生</Button>
          </Space>
        </TabPane>
        <TabPane tab="医生预设提示词" key="presets">
          <Space direction="vertical" style={{ width: '100%' }}>
            <Alert type="info" showIcon message="医生预设提示词" description="预设各主要科室医生的提示词模板，可在医生配置中快速引用并继续编辑。" />
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handlePresetDragEnd}>
              <SortableContext items={localPresetPrompts.map((p) => p.id)} strategy={verticalListSortingStrategy}>
                {localPresetPrompts.map((preset, index) => (
                  <SortablePresetCard key={preset.id} preset={preset} index={index} onRemove={removePreset} onUpdate={updatePreset} />
                ))}
              </SortableContext>
            </DndContext>
            <Button type="dashed" block onClick={addPreset}>+ 添加预设提示词</Button>
          </Space>
        </TabPane>
        <TabPane tab="全局参数" key="globalSettings">
          <Form layout="vertical">
            <Form.Item label="全局系统提示词">
              <TextArea value={localSettings.globalSystemPrompt} onChange={(e) => setLocalSettings((prev) => ({ ...prev, globalSystemPrompt: e.target.value }))} rows={6} />
            </Form.Item>
            <Form.Item label="最终总结提示词（默认）">
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
        <TabPane tab="图片识别" key="imageRecognition">
          <Form layout="vertical">
            <Form.Item>
              <Checkbox checked={localImageRecognition.enabled} onChange={(e) => setLocalImageRecognition((prev) => ({ ...prev, enabled: e.target.checked }))}>
                启用图像识别功能
              </Checkbox>
            </Form.Item>
            {localImageRecognition.enabled && (
              <>
                <Alert type="info" showIcon message="使用硅基流动的图片识别API" description="请选择支持图片识别的模型，并填写相应的API Key。" style={{ marginBottom: '16px' }} />
                <Row gutter={8}>
                  <Col span={8}>
                    <Form.Item label="供应商">
                      <Select value={localImageRecognition.provider} disabled>
                        <Select.Option value="siliconflow">硅基流动</Select.Option>
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item label="API Key">
                      <Input.Password value={localImageRecognition.apiKey} onChange={(e) => setLocalImageRecognition((prev) => ({ ...prev, apiKey: e.target.value }))} placeholder="sk-..." />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item label="最大并发识别数">
                      <InputNumber value={localImageRecognition.maxConcurrent} onChange={(value) => setLocalImageRecognition((prev) => ({ ...prev, maxConcurrent: value }))} min={1} max={10} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                </Row>
                <Row gutter={8}>
                  <Col span={12}>
                    <Form.Item label="模型名称（可手动输入）">
                      <Input value={localImageRecognition.model} onChange={(e) => setLocalImageRecognition((prev) => ({ ...prev, model: e.target.value }))} placeholder="Pro/Qwen/Qwen2-VL-72B-Instruct" />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item label="选择模型">
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                        <Select
                          style={{ flex: 1, minWidth: 0 }}
                          value={localImageRecognition.model}
                          onChange={(value) => setLocalImageRecognition((prev) => ({ ...prev, model: value }))}
                          options={imageModelOptions}
                          showSearch
                          loading={loadingImageModel}
                          placeholder="点击右侧按钮加载模型列表"
                          dropdownMatchSelectWidth={false}
                        />
                        <Button loading={loadingImageModel} style={{ flexShrink: 0 }} onClick={loadImageModels}>加载模型</Button>
                      </div>
                    </Form.Item>
                  </Col>
                </Row>
                <Row gutter={8}>
                  <Col span={12}>
                    <Form.Item label="自定义 Base URL">
                      <Input value={localImageRecognition.baseUrl} onChange={(e) => setLocalImageRecognition((prev) => ({ ...prev, baseUrl: e.target.value }))} placeholder="留空使用默认" />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item label="测试工具">
                      <div className="test-controls">
                        <Upload beforeUpload={handleTestImageUpload} showUploadList={false} accept="image/*">
                          <Button size="small">📷 选择测试图片</Button>
                        </Upload>
                        <Button type="primary" loading={testingImageAPI} onClick={testImageAPI}>测试图像识别API</Button>
                      </div>
                      {testImage && (
                        <div className="test-preview">
                          <img src={testImage.preview} alt="测试图片" />
                          <div className="test-preview-info">
                            <div className="name">{testImage.name}</div>
                            <Button type="link" size="small" danger onClick={removeTestImage}>移除</Button>
                          </div>
                        </div>
                      )}
                      <div className="test-tip">{testImage ? '将使用上传的图片进行测试' : '若未上传测试图片，将使用默认示例图片'}</div>
                    </Form.Item>
                  </Col>
                </Row>
                <Form.Item label="图像识别提示词">
                  <TextArea value={localImageRecognition.prompt} onChange={(e) => setLocalImageRecognition((prev) => ({ ...prev, prompt: e.target.value }))} rows={4} placeholder="描述图像识别的需求..." />
                </Form.Item>
              </>
            )}
          </Form>
        </TabPane>
        <TabPane tab="导入导出" key="importExport">
          <Space direction="vertical" style={{ width: '100%' }} size={24}>
            <Card title="导出设置" size="small">
              <Space direction="vertical" style={{ width: '100%' }}>
                <Alert type="info" showIcon message="导出设置" description="选择要导出的配置项，导出为JSON文件。" />
                <Checkbox.Group value={exportSelection} onChange={setExportSelection} style={{ width: '100%' }}>
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <Checkbox value="doctors">医生配置</Checkbox>
                    <Checkbox value="presetPrompts">医生预设提示词</Checkbox>
                    <Checkbox value="settings">全局设置</Checkbox>
                    <Checkbox value="imageRecognition">图片识别</Checkbox>
                  </Space>
                </Checkbox.Group>
                <Button type="primary" onClick={handleExport} disabled={exportSelection.length === 0}>导出选中项</Button>
              </Space>
            </Card>
            <Card title="导入设置" size="small">
              <Space direction="vertical" style={{ width: '100%' }}>
                <Alert type="info" showIcon message="导入设置" description="选择JSON文件导入配置。如果文件中包含某项配置，将自动导入并覆盖现有配置。" />
                <Upload beforeUpload={handleImport} showUploadList={false} accept=".json">
                  <Button type="primary">📁 选择JSON文件导入</Button>
                </Upload>
              </Space>
            </Card>
          </Space>
        </TabPane>
      </Tabs>
    </Modal>
  );
}

export default GlobalSettingsModal;
