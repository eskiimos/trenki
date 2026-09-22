'use client';

// Обработка видео в эталон движений прямо в браузере админа: скачиваем файл
// через наш домен (иначе браузер не даст читать пиксели), идём по видео с
// шагом 1/REFERENCE_FPS секунды, на каждом кадре MediaPipe находит скелет.
// Результат — gzip JSON на платформу (PUT /api/admin/pose-references/[id]).

import { useEffect, useRef, useState } from 'react';
import { Play, Square, AlertTriangle } from 'lucide-react';
import { AdminButton } from '@/components/admin/ui';
import { POSE_REFERENCE_FORMAT, REFERENCE_FPS, encodeFrame, type PoseReferenceDoc } from '@/lib/pose/reference';
import { createLandmarker, REFERENCE_MODEL, type Landmarker } from './landmarker';
import { containRect, drawSkeleton } from './draw';

type Phase = 'idle' | 'download' | 'model' | 'process' | 'upload' | 'error';

class Cancelled extends Error {}

const mb = (b: number) => `${(b / 1024 / 1024).toFixed(0)} МБ`;
const mmss = (sec: number) => {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/** Перемотка к моменту t и ожидание готового кадра. */
function seekTo(video: HTMLVideoElement, t: number): Promise<void> {
  return new Promise((resolve) => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const done = () => {
      video.removeEventListener('seeked', done);
      if (timer) clearTimeout(timer);
      resolve();
    };
    video.addEventListener('seeked', done);
    // Страховка: некоторые браузеры не шлют seeked при перемотке в ту же точку
    timer = setTimeout(done, 3000);
    video.currentTime = t;
  });
}

async function gzipJson(doc: unknown): Promise<ArrayBuffer> {
  const stream = new Blob([JSON.stringify(doc)]).stream().pipeThrough(new CompressionStream('gzip'));
  return new Response(stream).arrayBuffer();
}

export default function ReferenceProcessor({
  videoId,
  sourceUrl,
  onDone,
}: {
  videoId: string;
  sourceUrl: string;
  onDone: () => void;
}) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [progress, setProgress] = useState(0);
  const [detail, setDetail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const cancelRef = useRef(false);
  const busyRef = useRef(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Уход со страницы во время обработки — отменяем, чтобы не держать ресурсы
  useEffect(() => () => {
    cancelRef.current = true;
  }, []);

  const drawPreview = (frame: number[]) => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const w = video.clientWidth;
    const h = video.clientHeight;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    const ctx = canvas.getContext('2d');
    if (ctx) drawSkeleton(ctx, frame, containRect(w, h, video.videoWidth, video.videoHeight), dpr);
  };

  const run = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    cancelRef.current = false;
    setError(null);
    setProgress(0);
    let objectUrl: string | null = null;
    let landmarker: Landmarker | null = null;
    let wakeLock: { release: () => Promise<void> } | null = null;
    try {
      // Экран не гаснет, пока идёт обработка (на телефоне иначе всё встанет)
      try {
        wakeLock = await (navigator as unknown as { wakeLock?: { request: (t: string) => Promise<{ release: () => Promise<void> }> } }).wakeLock?.request('screen') ?? null;
      } catch {
        wakeLock = null;
      }

      // 1) Скачиваем видео целиком: перемотка по локальному файлу быстрая и точная
      setPhase('download');
      const res = await fetch(sourceUrl, { cache: 'no-store' });
      if (!res.ok || !res.body) throw new Error('Не удалось скачать видео');
      const total = Number(res.headers.get('content-length')) || 0;
      const reader = res.body.getReader();
      const chunks: Uint8Array[] = [];
      let got = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (cancelRef.current) {
          await reader.cancel();
          throw new Cancelled();
        }
        chunks.push(value);
        got += value.length;
        setProgress(total ? got / total : 0);
        setDetail(total ? `${mb(got)} из ${mb(total)}` : mb(got));
      }
      const blob = new Blob(chunks as BlobPart[], { type: res.headers.get('content-type') || 'video/mp4' });
      objectUrl = URL.createObjectURL(blob);
      const video = videoRef.current!;
      const src = objectUrl;
      await new Promise<void>((resolve, reject) => {
        // Обработчики — до src, иначе быстрый loadeddata проскочит мимо
        video.onloadeddata = () => resolve();
        video.onerror = () => reject(new Error('Браузер не смог открыть видео (формат?)'));
        video.src = src;
      });

      // 2) Модель
      setPhase('model');
      setProgress(0);
      setDetail('');
      landmarker = await createLandmarker();
      if (cancelRef.current) throw new Cancelled();

      // 3) Кадры
      setPhase('process');
      const duration = video.duration;
      const n = Math.max(1, Math.floor(duration * REFERENCE_FPS) + 1);
      const frames: number[][] = [];
      const startedAt = performance.now();
      let found = 0;
      for (let i = 0; i < n; i++) {
        if (cancelRef.current) throw new Cancelled();
        const t = Math.min(i / REFERENCE_FPS, Math.max(0, duration - 0.05));
        await seekTo(video, t);
        const tMs = Math.round(t * 1000);
        // VIDEO-режим требует строго растущих меток времени
        const prevT = frames.length ? frames[frames.length - 1]![0]! : -1;
        const r = landmarker.detectForVideo(video, Math.max(tMs, prevT + 1));
        const frame = encodeFrame(Math.max(tMs, prevT + 1), r.landmarks?.[0], r.worldLandmarks?.[0]);
        if (frame.length > 1) found++;
        frames.push(frame);
        if (i % 3 === 0 || i === n - 1) {
          drawPreview(frame);
          const elapsed = (performance.now() - startedAt) / 1000;
          const left = i > 0 ? (elapsed / (i + 1)) * (n - i - 1) : 0;
          setProgress((i + 1) / n);
          setDetail(
            `${mmss(t)} из ${mmss(duration)} видео · тренер найден в ${Math.round((found / (i + 1)) * 100)}% кадров · осталось ≈ ${mmss(left)}`,
          );
        }
      }

      // 4) На платформу
      setPhase('upload');
      setDetail('');
      const doc: PoseReferenceDoc = {
        v: POSE_REFERENCE_FORMAT,
        model: REFERENCE_MODEL,
        fps: REFERENCE_FPS,
        durationMs: Math.round(duration * 1000),
        width: video.videoWidth,
        height: video.videoHeight,
        frames,
      };
      const body = await gzipJson(doc);
      const up = await fetch(`/api/admin/pose-references/${videoId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/gzip' },
        body,
      });
      const d = await up.json().catch(() => ({}));
      if (!up.ok) throw new Error(d?.error || 'Не удалось сохранить эталон');
      setPhase('idle');
      onDone();
    } catch (e) {
      if (e instanceof Cancelled) {
        setPhase('idle');
        setDetail('');
      } else {
        setError(e instanceof Error ? e.message : 'Ошибка обработки');
        setPhase('error');
      }
    } finally {
      busyRef.current = false;
      try {
        landmarker?.close();
      } catch {
        /* ignore */
      }
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      if (wakeLock) wakeLock.release().catch(() => {});
    }
  };

  const running = phase === 'download' || phase === 'model' || phase === 'process' || phase === 'upload';
  const label: Record<Phase, string> = {
    idle: '',
    download: 'Скачиваю видео',
    model: 'Загружаю модель распознавания (≈ 30 МБ)',
    process: 'Распознаю движения',
    upload: 'Сохраняю эталон на платформе',
    error: 'Ошибка',
  };

  return (
    <div className="flex flex-col" style={{ gap: 16 }}>
      <div
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '16 / 9',
          background: '#000',
          borderRadius: 'var(--radius-md)',
          overflow: 'hidden',
          display: running && phase !== 'download' ? 'block' : 'none',
        }}
      >
        <video ref={videoRef} muted playsInline preload="auto" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} />
      </div>

      {running && (
        <div>
          <div className="flex items-center justify-between gap-3" style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>
            <span>{label[phase]}…</span>
            {phase !== 'model' && phase !== 'upload' && <span>{Math.round(progress * 100)}%</span>}
          </div>
          <div style={{ height: 8, borderRadius: 999, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                width: `${phase === 'model' || phase === 'upload' ? 100 : Math.round(progress * 100)}%`,
                background: 'var(--color-brand)',
                opacity: phase === 'model' || phase === 'upload' ? 0.4 : 1,
                transition: 'width 0.3s',
              }}
            />
          </div>
          {detail && <div style={{ color: 'var(--color-muted)', fontSize: 13, marginTop: 8 }}>{detail}</div>}
          <div style={{ color: 'var(--color-muted)', fontSize: 12, marginTop: 8 }}>
            Не закрывайте и не сворачивайте вкладку: в фоне браузер почти останавливает обработку.
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2" role="alert" style={{ color: 'var(--color-danger)', fontSize: 14 }}>
          <AlertTriangle size={20} style={{ flexShrink: 0 }} aria-hidden />
          <span>{error}</span>
        </div>
      )}

      <div>
        {running ? (
          <AdminButton type="button" tone="secondary" icon={Square} onClick={() => (cancelRef.current = true)} disabled={phase === 'upload'}>
            Остановить
          </AdminButton>
        ) : (
          <AdminButton type="button" icon={Play} onClick={run}>
            {phase === 'error' ? 'Попробовать снова' : 'Обработать видео'}
          </AdminButton>
        )}
      </div>
    </div>
  );
}
