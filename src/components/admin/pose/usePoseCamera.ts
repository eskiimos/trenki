'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { encodeFrame } from '@/lib/pose/reference';
import { containRect, drawSkeleton } from './draw';
import { createCameraDetector, createMainDetector, type CameraDetector } from './camera-detector';

export type PoseCameraStatus = 'off' | 'loading' | 'ready';

interface Options<T> {
  onFrame: (frame: number[], timestampMs: number, context: T | undefined) => void;
  facingMode?: 'user' | 'environment';
  captureContext?: () => T;
  highlights?: () => number[];
  onUnavailable?: () => void;
}

interface CameraSession {
  generation: number;
  destroyed: boolean;
  video: HTMLVideoElement | null;
  stream: MediaStream | null;
  landmarker: CameraDetector | null;
  controller: AbortController;
  animationFrame: number | null;
  removeListeners: Array<() => void>;
}

function cameraError(error: unknown): string {
  const name = error instanceof Error ? error.name : '';
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    return 'Доступ к камере запрещён. Разрешите его в настройках браузера и попробуйте снова.';
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return 'Камера не найдена. Подключите её и попробуйте снова.';
  }
  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return 'Камера недоступна. Закройте другие приложения, которые её используют, и попробуйте снова.';
  }
  return 'Не удалось включить камеру. Проверьте её подключение и разрешение в браузере.';
}

function disposeSession(session: CameraSession) {
  if (session.destroyed) return;
  session.destroyed = true;
  session.controller.abort();
  if (session.animationFrame !== null) cancelAnimationFrame(session.animationFrame);
  session.removeListeners.forEach((remove) => remove());
  session.removeListeners = [];
  session.stream?.getTracks().forEach((track) => track.stop());
  if (session.video && session.video.srcObject === session.stream) {
    session.video.pause();
    session.video.srcObject = null;
  }
  // close() освобождает WASM/WebGL. Ошибка освобождения не должна мешать
  // отключению остальных ресурсов или повторному запросу камеры.
  try { session.landmarker?.close(); } catch { /* already closed */ }
  session.landmarker = null;
}

/** Камера и распознавание работают локально; кадров и звука на сервере нет. */
export function usePoseCamera<T>({ onFrame, onUnavailable, captureContext, highlights, facingMode = 'user' }: Options<T>) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sessionRef = useRef<CameraSession | null>(null);
  const generationRef = useRef(0);
  const mountedRef = useRef(false);
  const pendingRef = useRef<Promise<void> | null>(null);
  const callbacksRef = useRef({ onFrame, onUnavailable, captureContext, highlights, facingMode });
  const [status, setStatus] = useState<PoseCameraStatus>('off');
  const [error, setError] = useState<string | null>(null);
  const [execution, setExecution] = useState<'worker' | 'main' | null>(null);
  const [delegate, setDelegate] = useState<'GPU' | 'CPU' | null>(null);
  const [actualFacingMode, setActualFacingMode] = useState<'user' | 'environment' | null>(null);

  useEffect(() => { callbacksRef.current = { onFrame, onUnavailable, captureContext, highlights, facingMode }; }, [onFrame, onUnavailable, captureContext, highlights, facingMode]);

  const clearDrawing = useCallback(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (canvas && context) context.clearRect(0, 0, canvas.width, canvas.height);
  }, []);

  const release = useCallback(() => {
    generationRef.current += 1;
    if (sessionRef.current) disposeSession(sessionRef.current);
    sessionRef.current = null;
    pendingRef.current = null;
    if (mountedRef.current) setActualFacingMode(null);
    clearDrawing();
  }, [clearDrawing]);

  const stop = useCallback(() => {
    release();
    if (mountedRef.current) {
      setStatus('off');
      setDelegate(null);
      setExecution(null);
    }
  }, [release]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      release();
    };
  }, [release]);

  const start = useCallback((): Promise<void> => {
    if (!mountedRef.current) return Promise.resolve();
    if (pendingRef.current) return pendingRef.current;
    if (sessionRef.current && !sessionRef.current.destroyed) return Promise.resolve();

    const session: CameraSession = {
      generation: ++generationRef.current,
      destroyed: false,
      video: null,
      stream: null,
      landmarker: null,
      controller: new AbortController(),
      animationFrame: null,
      removeListeners: [],
    };
    sessionRef.current = session;
    setStatus('loading');
    setError(null);
    setDelegate(null);
      setExecution(null);
    const isCurrent = () => mountedRef.current && !session.destroyed &&
      sessionRef.current === session && generationRef.current === session.generation;
    const fail = (message: string) => {
      if (!isCurrent()) return;
      release();
      setStatus('off');
      setDelegate(null);
      setExecution(null);
      setError(message);
      callbacksRef.current.onUnavailable?.();
    };

    const setup = async () => {
      let phase: 'camera' | 'model' = 'camera';
      try {
        if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
          fail('Камере нужен HTTPS и браузер с поддержкой getUserMedia. Откройте страницу по защищённому адресу.');
          return;
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: callbacksRef.current.facingMode, width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });
        if (!isCurrent()) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        session.stream = stream;
        const actualMode = stream.getVideoTracks()[0]?.getSettings?.().facingMode;
        setActualFacingMode(actualMode === 'user' || actualMode === 'environment' ? actualMode : null);
        const video = videoRef.current;
        if (!video) {
          fail('Не удалось открыть предпросмотр камеры. Обновите страницу и попробуйте снова.');
          return;
        }
        session.video = video;
        video.srcObject = stream;
        video.muted = true;
        video.playsInline = true;
        const onEnded = () => fail('Камера отключилась. Проверьте подключение и включите её снова.');
        stream.getVideoTracks().forEach((track) => {
          track.addEventListener('ended', onEnded);
          session.removeListeners.push(() => track.removeEventListener('ended', onEnded));
        });
        await video.play();
        if (!isCurrent()) return;
        phase = 'model';
        const landmarker = await createCameraDetector(session.controller.signal);
        if (!isCurrent()) {
          try { landmarker.close(); } catch { /* already closed */ }
          return;
        }
        session.landmarker = landmarker;
        setDelegate(landmarker.delegate);
        setExecution(landmarker.execution);
        setStatus('ready');

        let intervalMs = landmarker.delegate === 'GPU' ? 100 : 200;
        let busy = false;
        let lastDetectionMs = -Infinity;
        let lastVideoTime = -1;
        let lastFreshFrameMs = performance.now();
        let unavailable = false;
        const notifyUnavailable = () => {
          clearDrawing();
          if (!unavailable) callbacksRef.current.onUnavailable?.();
          unavailable = true;
        };
        const onVisibility = () => {
          if (document.hidden) notifyUnavailable();
          else lastFreshFrameMs = performance.now();
        };
        document.addEventListener('visibilitychange', onVisibility);
        session.removeListeners.push(() => document.removeEventListener('visibilitychange', onVisibility));
        if (document.hidden) notifyUnavailable();

        const loop = () => {
          if (!isCurrent()) return;
          if (!document.hidden) {
            const now = performance.now();
            const fresh = video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
              video.videoWidth > 0 && video.currentTime !== lastVideoTime;
            if (fresh) lastFreshFrameMs = now;
            if (now - lastFreshFrameMs > 1000) notifyUnavailable();
            if (fresh && !busy && now - lastDetectionMs >= intervalMs) {
              const timestampMs = Math.max(now, lastDetectionMs + 1);
              lastDetectionMs = timestampMs;
              lastVideoTime = video.currentTime;
              unavailable = false;
              busy = true;
              const capture = callbacksRef.current.captureContext?.();
              const detector = session.landmarker!;
              void detector.detect(video, timestampMs).then(result => {
                if (!isCurrent()) return;
                if (document.hidden || performance.now() - timestampMs > 1000) { notifyUnavailable(); return; }
                const frame = encodeFrame(timestampMs, result.landmarks?.[0], result.worldLandmarks?.[0]);
                callbacksRef.current.onFrame(frame, timestampMs, capture);
                const canvas = canvasRef.current;
                const context = canvas?.getContext('2d');
                if (canvas && context) {
                  const { width, height } = canvas.getBoundingClientRect();
                  const dpr = Math.min(window.devicePixelRatio || 1, 2);
                  const pixelWidth = Math.round(width * dpr), pixelHeight = Math.round(height * dpr);
                  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) { canvas.width = pixelWidth; canvas.height = pixelHeight; }
                  drawSkeleton(context, frame, containRect(width, height, video.videoWidth, video.videoHeight), dpr, callbacksRef.current.highlights?.());
                }
              }).catch(async () => {
                if (!isCurrent()) return;
                if (detector.execution === 'worker') {
                  // Stop scoring before changing execution mode. No stale result
                  // may cross this boundary, and the user explicitly resumes.
                  notifyUnavailable(); detector.close(); setStatus('loading');
                  try {
                    const fallback = await createMainDetector(session.controller.signal);
                    if (!isCurrent()) { fallback.close(); return; }
                    session.landmarker = fallback;
                    intervalMs = fallback.delegate === 'GPU' ? 100 : 200;
                    setDelegate(fallback.delegate); setExecution('main'); setStatus('ready');
                    lastFreshFrameMs = performance.now(); lastVideoTime = -1;
                  } catch { fail('Не удалось восстановить распознавание. Включите камеру снова.'); }
                } else fail('Распознавание движений остановилось. Включите камеру снова; если ошибка повторяется, попробуйте другой браузер.');
              }).finally(() => { busy = false; });
            }
          }
          if (isCurrent()) session.animationFrame = requestAnimationFrame(loop);
        };
        session.animationFrame = requestAnimationFrame(loop);
      } catch (setupError) {
        fail(phase === 'model'
          ? 'Не удалось загрузить модель распознавания. Проверьте интернет и попробуйте включить камеру снова.'
          : cameraError(setupError));
      }
    };

    const pending = setup();
    pendingRef.current = pending;
    void pending.finally(() => {
      if (pendingRef.current === pending) pendingRef.current = null;
    });
    return pending;
  }, [clearDrawing, release]);

  return { videoRef, canvasRef, status, error, start, stop, delegate, execution, actualFacingMode };
}
