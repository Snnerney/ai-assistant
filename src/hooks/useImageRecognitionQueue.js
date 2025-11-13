import { useState, useEffect, useCallback, useRef } from 'react';
import { useConsultStore } from '../store/useConsultStore';
import { useGlobalStore } from '../store/useGlobalStore';
import { recognizeImageWithSiliconFlow } from '../api/imageRecognition';

function normalizeStatus(status, result, error) {
  if (status === 'recognizing') return 'recognizing';
  if (status === 'queued') return 'queued';
  if (status === 'success' || result) return 'success';
  if (status === 'error' || error) return 'error';
  return 'queued';
}

function normalizeImagesFromStore(list) {
  if (!Array.isArray(list) || !list.length) return [];
  const now = Date.now();
  return list.map((item, idx) => ({
    id: item?.id || `img-${now}-${idx}`,
    name: item?.name || '',
    dataUrl: item?.dataUrl || item?.imageUrl || '',
    result: item?.result || '',
    status: normalizeStatus(item?.status, item?.result, item?.error),
    error: item?.error || '',
    raw: item?.raw || '',
    createdAt: item?.createdAt || now
  }));
}

function toBase64(file) {
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
}

export function useImageRecognitionQueue(options = {}) {
  const { onQueued, onStatusChange } = options || {};
  
  const patientCase = useConsultStore((state) => state.patientCase);
  const setPatientCase = useConsultStore((state) => state.setPatientCase);
  const imageRecognition = useGlobalStore((state) => state.imageRecognition);
  
  const syncingRef = useRef(false);
  const syncResetTimerRef = useRef(null);
  
  const [uploadedImages, setUploadedImages] = useState(() => {
    const saved = normalizeImagesFromStore(patientCase?.imageRecognitions);
    if (saved.length) return saved;
    if (patientCase?.imageRecognitionResult) {
      return [
        {
          id: `legacy-${Date.now()}`,
          name: '',
          dataUrl: '',
          result: patientCase.imageRecognitionResult,
          status: 'success',
          error: '',
          raw: '',
          createdAt: Date.now()
        }
      ];
    }
    return [];
  });

  const imageRecognitionEnabled = imageRecognition?.enabled || false;
  const maxConcurrent = (() => {
    const value = imageRecognition?.maxConcurrent;
    const num = Number(value);
    if (Number.isFinite(num) && num >= 1) {
      return Math.floor(num);
    }
    return 1;
  })();

  const queuedImages = uploadedImages.filter((img) => img.status === 'queued');
  const recognizingImages = uploadedImages.filter((img) => img.status === 'recognizing');
  const queuedCount = queuedImages.length;
  const recognizingCount = recognizingImages.length;
  const pendingImages = uploadedImages.filter((img) => img.status === 'queued' || img.status === 'recognizing');
  const hasPendingImages = pendingImages.length > 0;

  const sanitizeImages = useCallback(() => {
    return uploadedImages.map((item) => ({
      id: item.id,
      name: item.name,
      dataUrl: item.dataUrl,
      result: item.result,
      status: item.status,
      error: item.error,
      createdAt: item.createdAt,
      raw: item.status === 'queued' || item.status === 'recognizing' ? item.raw : ''
    }));
  }, [uploadedImages]);

  const syncCaseImageState = useCallback(() => {
    syncingRef.current = true;
    if (syncResetTimerRef.current) clearTimeout(syncResetTimerRef.current);
    setPatientCase({ imageRecognitions: sanitizeImages() });
    syncResetTimerRef.current = setTimeout(() => {
      syncingRef.current = false;
      syncResetTimerRef.current = null;
    }, 0);
  }, [sanitizeImages, setPatientCase]);

  const processSingleImage = useCallback(async (imageItem) => {
    try {
      const result = await recognizeImageWithSiliconFlow({
        apiKey: imageRecognition.apiKey,
        baseUrl: imageRecognition.baseUrl,
        model: imageRecognition.model,
        prompt: imageRecognition.prompt,
        imageBase64: imageItem.raw
      });
      
      setUploadedImages((prev) =>
        prev.map((img) =>
          img.id === imageItem.id
            ? { ...img, result, status: 'success', error: '', raw: '' }
            : img
        )
      );
      
      if (typeof onStatusChange === 'function') {
        onStatusChange(imageItem, 'success', { result });
      }
    } catch (err) {
      const error = err?.message || '图片识别失败，请检查配置';
      
      setUploadedImages((prev) =>
        prev.map((img) =>
          img.id === imageItem.id
            ? { ...img, status: 'error', error }
            : img
        )
      );
      
      if (typeof onStatusChange === 'function') {
        onStatusChange(imageItem, 'error', { error, rawError: err });
      }
    }
  }, [imageRecognition, onStatusChange]);

  const processQueue = useCallback(() => {
    setUploadedImages((prev) => {
      const recognizing = prev.filter((img) => img.status === 'recognizing');
      if (recognizing.length >= maxConcurrent) {
        return prev;
      }
      
      const nextIndex = prev.findIndex((img) => img.status === 'queued');
      if (nextIndex === -1) {
        return prev;
      }
      
      const newImages = [...prev];
      const next = { ...newImages[nextIndex], status: 'recognizing' };
      newImages[nextIndex] = next;
      
      if (typeof onStatusChange === 'function') {
        onStatusChange(next, 'recognizing');
      }
      
      // Process in background
      processSingleImage(next);
      
      return newImages;
    });
  }, [maxConcurrent, onStatusChange, processSingleImage]);

  const queueImageFile = useCallback(async (file) => {
    if (!imageRecognitionEnabled) {
      throw new Error('请先在设置中启用图像识别功能');
    }
    
    const base64 = await toBase64(file);
    const item = {
      id: `img-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name: file.name,
      dataUrl: base64.full,
      result: '',
      status: 'queued',
      error: '',
      raw: base64.raw,
      createdAt: Date.now()
    };
    
    setUploadedImages((prev) => [...prev, item]);
    
    if (typeof onQueued === 'function') {
      onQueued(item);
    }
    
    // Trigger processing after state update
    setTimeout(() => processQueue(), 0);
    
    return item;
  }, [imageRecognitionEnabled, onQueued, processQueue]);

  const removeImage = useCallback((index) => {
    if (index < 0) return;
    setUploadedImages((prev) => {
      if (index >= prev.length) return prev;
      const newImages = [...prev];
      newImages.splice(index, 1);
      return newImages;
    });
  }, []);

  // Sync images state to store
  useEffect(() => {
    syncCaseImageState();
  }, [uploadedImages, syncCaseImageState]);

  // Auto process queue when images change
  useEffect(() => {
    const timer = setTimeout(() => {
      const hasQueued = uploadedImages.some((img) => img.status === 'queued');
      const recognizing = uploadedImages.filter((img) => img.status === 'recognizing');
      if (hasQueued && recognizing.length < maxConcurrent) {
        processQueue();
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [uploadedImages, maxConcurrent, processQueue]);

  // Watch external changes to patient case
  useEffect(() => {
    if (syncingRef.current) return;
    
    const normalized = normalizeImagesFromStore(patientCase?.imageRecognitions);
    const incomingMap = new Map(normalized.map((item) => [item.id, item]));
    
    setUploadedImages((prev) => {
      const updated = [];
      
      // Update or remove existing
      for (const current of prev) {
        const incoming = incomingMap.get(current.id);
        if (incoming) {
          updated.push({ ...current, ...incoming });
          incomingMap.delete(current.id);
        }
      }
      
      // Add new ones
      incomingMap.forEach((item) => {
        updated.push(item);
      });
      
      return updated;
    });
  }, [patientCase?.imageRecognitions]);

  return {
    uploadedImages,
    imageRecognitionConfig: imageRecognition,
    imageRecognitionEnabled,
    maxConcurrent,
    queuedImages,
    recognizingImages,
    queuedCount,
    recognizingCount,
    pendingImages,
    hasPendingImages,
    queueImageFile,
    removeImage
  };
}
