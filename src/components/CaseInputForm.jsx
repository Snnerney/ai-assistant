import React, { useState, useEffect } from 'react';
import { Card, Form, Row, Col, Input, Select, InputNumber, Button, Upload, Alert, Spin, message as antMessage } from 'antd';
import { useConsultStore } from '../store/useConsultStore';
import { useImageRecognitionQueue } from '../hooks/useImageRecognitionQueue';
import './CaseInputForm.css';

const { TextArea } = Input;
const { Option } = Select;

function CaseInputForm() {
  const [form] = Form.useForm();
  
  const patientCase = useConsultStore((state) => state.patientCase);
  const setPatientCase = useConsultStore((state) => state.setPatientCase);
  const startConsultation = useConsultStore((state) => state.startConsultation);

  const {
    uploadedImages,
    imageRecognitionEnabled,
    recognizingCount,
    queuedCount,
    hasPendingImages,
    queueImageFile,
    removeImage: removeImageFromQueue
  } = useImageRecognitionQueue({
    onStatusChange(image, status, payload = {}) {
      if (status === 'success') {
        antMessage.success('图片识别完成');
      } else if (status === 'error') {
        antMessage.error(payload.error || image.error || '图片识别失败，请检查配置');
      }
    }
  });

  // Initialize form values from store
  useEffect(() => {
    form.setFieldsValue({
      name: patientCase.name || '',
      gender: patientCase.gender || undefined,
      age: patientCase.age,
      pastHistory: patientCase.pastHistory || '',
      currentProblem: patientCase.currentProblem || ''
    });
  }, [patientCase, form]);

  const sanitizeImages = () => {
    return (uploadedImages || []).map((item) => ({
      id: item.id,
      name: item.name,
      dataUrl: item.dataUrl,
      result: item.result,
      status: item.status,
      error: item.error,
      createdAt: item.createdAt,
      raw: item.status === 'queued' || item.status === 'recognizing' ? item.raw : ''
    }));
  };

  const handleImageUpload = async (file) => {
    if (!imageRecognitionEnabled) {
      antMessage.warning('请先在设置中启用图像识别功能');
      return false;
    }
    try {
      await queueImageFile(file);
      antMessage.success(`已添加图片：${file.name}`);
    } catch (err) {
      console.error(err);
      antMessage.error(err?.message || '读取图片失败，请重试');
    }
    return false;
  };

  const removeImage = (index) => {
    const target = uploadedImages[index];
    if (!target) return;
    if (target.status === 'recognizing') {
      antMessage.warning('当前图片正在识别中，无法删除');
      return;
    }
    removeImageFromQueue(index);
  };

  const onSubmit = (values) => {
    try {
      setPatientCase({
        name: values.name,
        gender: values.gender,
        age: values.age,
        pastHistory: values.pastHistory,
        currentProblem: values.currentProblem,
        imageRecognitions: sanitizeImages()
      });
      startConsultation();
    } catch (e) {
      antMessage.error(e.message || String(e));
    }
  };

  const openSettings = () => {
    const event = new CustomEvent('open-settings');
    window.dispatchEvent(event);
  };

  return (
    <Card title="病例输入" bordered={false} className="case-input-card">
      <Form form={form} layout="vertical" onFinish={onSubmit}>
        <Row gutter={16}>
          <Col span={8}>
            <Form.Item
              label="患者名称"
              name="name"
              rules={[{ required: true, message: '请输入患者名称' }]}
            >
              <Input placeholder="张三" />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item label="性别" name="gender">
              <Select placeholder="请选择性别">
                <Option value="male">男</Option>
                <Option value="female">女</Option>
                <Option value="other">其他</Option>
              </Select>
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item label="年龄" name="age">
              <InputNumber
                min={0}
                max={150}
                placeholder="请输入年龄"
                style={{ width: '100%' }}
              />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item label="既往疾病" name="pastHistory">
          <TextArea rows={3} placeholder="既往疾病、手术史、用药史等" />
        </Form.Item>

        <Form.Item
          label="本次问题"
          name="currentProblem"
          rules={[{ required: true, message: '请输入本次问题' }]}
        >
          <TextArea rows={4} placeholder="主诉与现病史" />
        </Form.Item>

        {imageRecognitionEnabled && (
          <Form.Item label="病灶图片">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <Upload
                beforeUpload={handleImageUpload}
                showUploadList={false}
                accept="image/*"
                multiple
              >
                <Button loading={hasPendingImages} icon={<span>📷</span>}>
                  {uploadedImages.length ? '继续上传图片' : '上传图片'}
                </Button>
              </Upload>

              {recognizingCount > 0 && (
                <div style={{ color: '#1890ff', fontSize: '12px' }}>
                  正在识别 {recognizingCount} 张图片，队列中等待 {queuedCount} 张
                </div>
              )}
              {recognizingCount === 0 && queuedCount > 0 && (
                <div style={{ color: '#faad14', fontSize: '12px' }}>
                  已加入识别队列，待识别图片 {queuedCount} 张
                </div>
              )}

              {uploadedImages.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px' }}>
                  {uploadedImages.map((image, index) => (
                    <div
                      key={image.id}
                      style={{
                        border: '1px solid #d9d9d9',
                        borderRadius: '4px',
                        padding: '8px'
                      }}
                    >
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                        {image.dataUrl ? (
                          <img
                            src={image.dataUrl}
                            alt="病灶图片"
                            style={{
                              width: '120px',
                              height: '120px',
                              objectFit: 'cover',
                              borderRadius: '4px',
                              flexShrink: 0
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              width: '120px',
                              height: '120px',
                              border: '1px dashed #d9d9d9',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#bfbfbf',
                              borderRadius: '4px',
                              flexShrink: 0,
                              fontSize: '12px'
                            }}
                          >
                            无预览
                          </div>
                        )}

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              marginBottom: '4px'
                            }}
                          >
                            <span style={{ fontWeight: 600, fontSize: '12px', color: '#595959' }}>
                              图片 {index + 1}
                            </span>
                            <Button
                              type="link"
                              danger
                              size="small"
                              onClick={() => removeImage(index)}
                            >
                              删除
                            </Button>
                          </div>

                          {image.status === 'recognizing' && (
                            <div style={{ color: '#1890ff', fontSize: '12px' }}>
                              <Spin size="small" style={{ marginRight: '4px' }} /> 识别中...
                            </div>
                          )}

                          {image.status === 'queued' && (
                            <div style={{ color: '#faad14', fontSize: '12px' }}>
                              <span style={{ marginRight: '4px' }}>⏳</span> 排队中，等待识别
                            </div>
                          )}

                          {image.status === 'success' && image.result && (
                            <div style={{ marginTop: '4px' }}>
                              <Alert
                                type="success"
                                message="识别成功"
                                showIcon
                                description={
                                  <div style={{ maxHeight: '80px', overflowY: 'auto', fontSize: '12px' }}>
                                    {image.result}
                                  </div>
                                }
                              />
                            </div>
                          )}

                          {image.status === 'error' && (
                            <div style={{ marginTop: '4px' }}>
                              <Alert
                                type="error"
                                message="识别失败"
                                showIcon
                                description={
                                  <div style={{ fontSize: '12px' }}>
                                    {image.error || '识别失败'}
                                  </div>
                                }
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Form.Item>
        )}

        <div style={{ display: 'flex', gap: '8px' }}>
          <Button type="primary" htmlType="submit">
            开始会诊
          </Button>
          <Button onClick={openSettings}>问诊设置</Button>
        </div>
      </Form>
    </Card>
  );
}

export default CaseInputForm;
