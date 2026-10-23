'use client';

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { EQUIPMENT_TARGETS, validateEquipmentSettings, type EquipmentDetection, type EquipmentSettings } from '@/lib/pose/equipment-tracker';
import { createEquipmentDetector, createMainEquipmentDetector, type EquipmentDetector } from './equipment-detector';
import { containRect } from './draw';

const STALE_MS = 500;
const TRAIL_MS = 800;
type TrailPoint = { x: number; y: number; time: number };

interface Options {
  videoRef: RefObject<HTMLVideoElement | null>;
  active: boolean;
  settings: EquipmentSettings;
}

interface Session {
  detector: EquipmentDetector | null;
  generation: number;
  destroyed: boolean;
  invalidate(): void;
}

/** Consumes the existing camera stream. No second camera permission or stream. */
export function useEquipmentTracking({ videoRef, active, settings }: Options) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const settingsRef = useRef(settings);
  const sessionRef = useRef<Session | null>(null);
  const [detection, setDetection] = useState<EquipmentDetection | null>(null);
  const [fps, setFps] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [execution, setExecution] = useState<'worker' | 'main' | null>(null);

  const clear = useCallback(() => {
    const canvas = canvasRef.current;
    canvas?.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
    setDetection(null);
    setFps(0);
  }, []);
  const reset = useCallback(() => {
    sessionRef.current?.invalidate();
    clear();
  }, [clear]);

  useEffect(() => {
    settingsRef.current = settings;
    reset();
    setError(validateEquipmentSettings(settings));
  }, [settings, reset]);

  useEffect(() => {
    if (!active) { clear(); setExecution(null); return; }
    const controller = new AbortController();
    const capture = document.createElement('canvas');
    const context = capture.getContext('2d', { willReadFrequently: true });
    if (!context) { setError('Не удалось подготовить распознавание инвентаря.'); return; }
    let animation: number | null = null;
    let busy = false;
    let trail: TrailPoint[] = [];
    let lastVideoTime = -1;
    let lastCapturedVideoTime = -1;
    let sourceWidth = 0;
    let sourceHeight = 0;
    let lastFreshTime = performance.now();
    let lastInference = -Infinity;
    let lastResultTime = -Infinity;
    let lastSummary = -Infinity;
    let lastFpsTime = performance.now();
    let frameCount = 0;
    let overlayVisible = false;
    const session: Session = {
      detector: null, generation: 0, destroyed: false,
      invalidate: () => {
        session.generation++;
        session.detector?.reset();
        trail = [];
        frameCount = 0;
        lastResultTime = -Infinity;
        lastSummary = -Infinity;
        lastFpsTime = performance.now();
        lastCapturedVideoTime = -1;
        overlayVisible = false;
      },
    };
    sessionRef.current = session;
    const current = () => !session.destroyed && sessionRef.current === session;
    const clearUnavailable = () => {
      session.invalidate();
      clear();
    };
    const visibility = () => {
      clearUnavailable();
      lastFreshTime = performance.now();
      lastVideoTime = -1;
    };
    document.addEventListener('visibilitychange', visibility);

    const draw = (result: EquipmentDetection, now: number) => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const drawing = canvas?.getContext('2d');
      if (!video || !canvas || !drawing) return;
      const box = video.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.round(box.width * dpr);
      const height = Math.round(box.height * dpr);
      if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
      const rect = containRect(box.width, box.height, video.videoWidth, video.videoHeight);
      drawing.clearRect(0, 0, canvas.width, canvas.height);
      drawing.save();
      drawing.scale(dpr, dpr);
      const point = (p: { x: number; y: number }) => ({ x: rect.x + p.x * rect.w, y: rect.y + p.y * rect.h });
      const ball = result.targets.ball;
      if (ball.status === 'observed' && ball.observation) {
        // A gap is not a trajectory. Only connect consecutive fresh observations.
        if (trail.length && now - trail[trail.length - 1].time > STALE_MS) trail = [];
        trail = trail.filter(p => now - p.time <= TRAIL_MS);
        trail.push({ x: ball.observation.x, y: ball.observation.y, time: now });
      } else trail = [];
      if (trail.length > 1) {
        drawing.beginPath();
        trail.forEach((p, i) => { const at = point(p); if (i === 0) drawing.moveTo(at.x, at.y); else drawing.lineTo(at.x, at.y); });
        drawing.strokeStyle = `hsl(${settingsRef.current.targets.ball.hue} 100% 60% / 0.55)`;
        drawing.lineWidth = 3;
        drawing.stroke();
      }
      if (result.stick && result.targets.stickTop.status === 'observed' && result.targets.stickTip.status === 'observed') {
        const top = point(result.stick.top), tip = point(result.stick.tip);
        drawing.lineCap = 'round';
        for (const pass of [0, 1]) {
          drawing.beginPath(); drawing.moveTo(top.x, top.y); drawing.lineTo(tip.x, tip.y);
          drawing.strokeStyle = pass === 0 ? '#060919' : '#FFFFFF';
          drawing.lineWidth = pass === 0 ? 7 : 3;
          drawing.stroke();
        }
      }
      for (const id of EQUIPMENT_TARGETS) {
        const target = result.targets[id];
        if (target.status !== 'observed' || !target.observation) continue;
        const at = point(target.observation);
        const radius = Math.max(7, target.observation.radius * Math.min(rect.w, rect.h) + 3);
        for (const pass of [0, 1]) {
          drawing.beginPath(); drawing.arc(at.x, at.y, radius, 0, Math.PI * 2);
          drawing.strokeStyle = pass === 0 ? '#060919' : `hsl(${settingsRef.current.targets[id].hue} 100% 60%)`;
          drawing.lineWidth = pass === 0 ? 6 : 3;
          drawing.stroke();
        }
      }
      drawing.restore();
      overlayVisible = true;
    };

    const infer = async (now: number, generation: number) => {
      const video = videoRef.current;
      if (!video || !session.detector) return;
      busy = true;
      try {
        lastCapturedVideoTime = video.currentTime;
        const scale = Math.min(1, 320 / Math.max(video.videoWidth, video.videoHeight));
        const width = Math.max(1, Math.round(video.videoWidth * scale));
        const height = Math.max(1, Math.round(video.videoHeight * scale));
        if (capture.width !== width || capture.height !== height) { capture.width = width; capture.height = height; }
        context.drawImage(video, 0, 0, width, height);
        const pixels = context.getImageData(0, 0, width, height);
        const result = await session.detector.detect({ width, height, data: pixels.data }, now, settingsRef.current);
        if (!current() || session.generation !== generation || document.hidden || performance.now() - now > STALE_MS) return;
        const receivedAt = performance.now();
        // Freshness belongs to the captured frame, not the later worker reply.
        lastResultTime = now;
        draw(result, now);
        frameCount++;
        if (receivedAt - lastSummary >= 200) {
          setDetection(result);
          lastSummary = receivedAt;
        }
        if (receivedAt - lastFpsTime >= 1000) {
          setFps(Math.round(frameCount * 1000 / (receivedAt - lastFpsTime)));
          frameCount = 0;
          lastFpsTime = receivedAt;
        }
      } catch (failure) {
        if (!current() || session.generation !== generation) return;
        if (failure instanceof Error && failure.name === 'AbortError') return;
        clearUnavailable();
        if (session.detector?.execution === 'worker') {
          session.detector.close();
          session.detector = createMainEquipmentDetector(controller.signal);
          setExecution('main');
        } else {
          setError('Не удалось распознать инвентарь. Выключите и снова включите камеру.');
          session.detector?.close();
          session.detector = null;
        }
      } finally { busy = false; }
    };

    const tick = (now: number) => {
      if (!current()) return;
      animation = requestAnimationFrame(tick);
      const video = videoRef.current;
      if (document.hidden) return;
      if (video && !video.paused && !video.ended && video.readyState >= 2 && video.videoWidth && video.videoHeight) {
        if (sourceWidth !== video.videoWidth || sourceHeight !== video.videoHeight) {
          sourceWidth = video.videoWidth;
          sourceHeight = video.videoHeight;
          clearUnavailable();
          lastVideoTime = -1;
          lastFreshTime = now;
        }
        if (video.currentTime !== lastVideoTime) { lastVideoTime = video.currentTime; lastFreshTime = now; }
        if (now - lastFreshTime <= STALE_MS) {
          if ((overlayVisible || lastResultTime !== -Infinity) && now - lastResultTime > STALE_MS) clearUnavailable();
          const interval = session.detector?.execution === 'worker' ? 1000 / 15 : 100;
          if (!busy && session.detector && lastCapturedVideoTime !== video.currentTime
            && now - lastInference >= interval && !validateEquipmentSettings(settingsRef.current)) {
            lastInference = now;
            void infer(now, session.generation);
          }
          return;
        }
      }
      if (overlayVisible || lastResultTime !== -Infinity) clearUnavailable();
    };

    void createEquipmentDetector(controller.signal).then(detector => {
      if (!current()) { detector.close(); return; }
      session.detector = detector;
      setExecution(detector.execution);
      setError(validateEquipmentSettings(settingsRef.current));
      animation = requestAnimationFrame(tick);
    }).catch(() => {
      if (current()) setError('Не удалось запустить распознавание инвентаря.');
    });

    return () => {
      session.destroyed = true;
      controller.abort();
      session.detector?.close();
      document.removeEventListener('visibilitychange', visibility);
      if (animation !== null) cancelAnimationFrame(animation);
      if (sessionRef.current === session) sessionRef.current = null;
      clear();
    };
  }, [active, videoRef, clear]);

  return { canvasRef, detection, fps, error, execution, reset };
}
