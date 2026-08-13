'use client';

import { useEffect, useRef, useState } from 'react';
import { X, Circle, Maximize2, Minimize2 } from 'lucide-react';

interface Props {
  videoId: string;
  onClose: () => void;
}

// Тип для MediaPipe (грузится из CDN — глобал window)
type Landmark = { x: number; y: number; z: number; visibility?: number };
type PoseResults = { landmarks: Landmark[][] };

// Соединения для отрисовки скелета (упрощённо — основные)
const POSE_CONNECTIONS: [number, number][] = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16], // руки + плечи
  [11, 23], [12, 24], [23, 24],                       // торс
  [23, 25], [25, 27], [27, 29], [29, 31], [27, 31],   // левая нога
  [24, 26], [26, 28], [28, 30], [30, 32], [28, 32],   // правая нога
];

/**
 * Виджет отслеживания позы (MediaPipe Pose Landmarker через CDN).
 * Запрашивает камеру, рисует скелет, при остановке отправляет статистику в API.
 */
export default function PoseTracker({ videoId, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const landmarkerRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const startedAtRef = useRef<number>(0);
  const framesRef = useRef<number>(0);
  const confSumRef = useRef<number>(0);
  const confCountRef = useRef<number>(0);
  // Записанные кадры скелета для воспроизведения тренеру.
  // Каждый кадр: [t_ms, x0,y0,v0, x1,y1,v1, ... x32,y32,v32] (x,y *1000 -> int; v *100 -> int)
  const recordedRef = useRef<number[][]>([]);
  const lastSampleAtRef = useRef<number>(0);
  const SAMPLE_FPS = 3; // достаточно для воспроизведения, резко уменьшает объём данных
  const MAX_FRAMES = SAMPLE_FPS * 60 * 2; // максимум 2 минуты записи

  const [status, setStatus] = useState<'init' | 'ready' | 'tracking' | 'error' | 'saving' | 'done'>('init');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [minimized, setMinimized] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function setup() {
      try {
        // 1. Подгружаем MediaPipe Tasks Vision из CDN (ESM)
        const visionModule: any = await import(
          /* webpackIgnore: true */
          // @ts-expect-error CDN URL
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs'
        );
        if (cancelled) return;

        const { FilesetResolver, PoseLandmarker } = visionModule;
        const fileset = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
        );
        if (cancelled) return;

        const landmarker = await PoseLandmarker.createFromOptions(fileset, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numPoses: 1,
        });
        if (cancelled) {
          landmarker.close?.();
          return;
        }
        landmarkerRef.current = landmarker;

        // 2. Запрашиваем камеру
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        setStatus('ready');
        startedAtRef.current = Date.now();
        framesRef.current = 0;
        confSumRef.current = 0;
        confCountRef.current = 0;
        setStatus('tracking');
        loop();
      } catch (err: any) {
        console.error('PoseTracker setup error:', err);
        setErrorMsg(err?.message || 'Не удалось запустить камеру или модель');
        setStatus('error');
      }
    }

    function loop() {
      if (!videoRef.current || !canvasRef.current || !landmarkerRef.current) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video.readyState < 2) {
        rafRef.current = requestAnimationFrame(loop);
        return;
      }
      canvas.width = video.videoWidth || 320;
      canvas.height = video.videoHeight || 240;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      try {
        const results: PoseResults = landmarkerRef.current.detectForVideo(video, performance.now());
        framesRef.current += 1;
        const poses = results.landmarks || [];
        if (poses.length > 0) {
          const lm = poses[0];
          // Считаем среднюю видимость как «уверенность»
          let visSum = 0;
          let visN = 0;
          for (const p of lm) {
            if (typeof p.visibility === 'number') {
              visSum += p.visibility;
              visN += 1;
            }
          }
          if (visN > 0) {
            confSumRef.current += visSum / visN;
            confCountRef.current += 1;
          }

          // Сэмплируем кадр для записи (с ограничением частоты и размера)
          const nowMs = performance.now();
          if (
            recordedRef.current.length < MAX_FRAMES &&
            nowMs - lastSampleAtRef.current >= 1000 / SAMPLE_FPS
          ) {
            lastSampleAtRef.current = nowMs;
            const t = Math.round(Date.now() - startedAtRef.current);
            const flat: number[] = [t];
            for (const p of lm) {
              flat.push(
                Math.round(p.x * 1000),
                Math.round(p.y * 1000),
                Math.round((p.visibility ?? 0) * 100),
              );
            }
            recordedRef.current.push(flat);
          }

          // Рисуем точки
          ctx.fillStyle = '#A1FF4A';
          for (const p of lm) {
            ctx.beginPath();
            ctx.arc(p.x * canvas.width, p.y * canvas.height, 3, 0, Math.PI * 2);
            ctx.fill();
          }
          // Рисуем связи
          ctx.strokeStyle = '#A1FF4A';
          ctx.lineWidth = 2;
          for (const [a, b] of POSE_CONNECTIONS) {
            const pa = lm[a];
            const pb = lm[b];
            if (!pa || !pb) continue;
            ctx.beginPath();
            ctx.moveTo(pa.x * canvas.width, pa.y * canvas.height);
            ctx.lineTo(pb.x * canvas.width, pb.y * canvas.height);
            ctx.stroke();
          }
        }
      } catch (err) {
        console.warn('pose detect error:', err);
      }

      rafRef.current = requestAnimationFrame(loop);
    }

    setup();

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      if (landmarkerRef.current?.close) {
        try {
          landmarkerRef.current.close();
        } catch {
          /* ignore */
        }
      }
    };
  }, []);

  const handleStop = async () => {
    setStatus('saving');
    const durationSec = Math.max(0, Math.round((Date.now() - startedAtRef.current) / 1000));
    const avgConfidence =
      confCountRef.current > 0 ? confSumRef.current / confCountRef.current : null;
    try {
      await fetch('/api/pose-sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoId,
          durationSec,
          framesCount: framesRef.current,
          avgConfidence,
          fps: SAMPLE_FPS,
          frames: recordedRef.current,
        }),
      });
    } catch (err) {
      console.warn('pose-sessions save error:', err);
    }
    setStatus('done');
    setTimeout(onClose, 600);
  };

  const containerStyle: React.CSSProperties = minimized
    ? { width: 140, height: 105 }
    : { width: 280, height: 210 };

  return (
    <div
      style={{
        position: 'fixed',
        right: 12,
        bottom: 90,
        zIndex: 1000,
        background: '#060919',
        border: '1px solid #26252F',
        borderRadius: 12,
        overflow: 'hidden',
        boxShadow: '0 10px 24px rgba(0,0,0,0.4)',
        ...containerStyle,
      }}
    >
      <video
        ref={videoRef}
        playsInline
        muted
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: 'scaleX(-1)',
        }}
      />
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          transform: 'scaleX(-1)',
          pointerEvents: 'none',
        }}
      />
      {/* Верхняя плашка со статусом */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          padding: '4px 8px',
          background: 'linear-gradient(180deg, rgba(0,0,0,0.7), transparent)',
          color: '#F9F8FE',
          fontSize: 10,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          {status === 'init' && 'Загрузка модели…'}
          {status === 'ready' && 'Готово'}
          {status === 'tracking' && (
            <>
              <Circle size={10} fill="#FF6B6B" color="#FF6B6B" aria-hidden />
              Запись
            </>
          )}
          {status === 'saving' && 'Сохранение…'}
          {status === 'done' && 'Готово'}
          {status === 'error' && 'Ошибка'}
        </span>
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            type="button"
            onClick={() => setMinimized((v) => !v)}
            aria-label={minimized ? 'Развернуть' : 'Свернуть'}
            style={{
              background: 'transparent',
              color: '#F9F8FE',
              border: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              padding: '0 4px',
            }}
          >
            {minimized ? <Maximize2 size={16} aria-hidden /> : <Minimize2 size={16} aria-hidden />}
          </button>
          <button
            type="button"
            onClick={status === 'tracking' ? handleStop : onClose}
            aria-label="Закрыть"
            style={{
              background: 'transparent',
              color: '#FF6B6B',
              border: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              padding: '0 4px',
            }}
          >
            <X size={16} aria-hidden />
          </button>
        </div>
      </div>
      {status === 'error' && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(6, 9, 25, 0.92)',
            color: '#FF6B6B',
            padding: 8,
            fontSize: 11,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
          }}
        >
          {errorMsg || 'Камера недоступна'}
        </div>
      )}
    </div>
  );
}
