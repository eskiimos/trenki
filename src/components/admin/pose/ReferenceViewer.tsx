'use client';

// Просмотр эталона движений: видео тренера, поверх — его скелет синхронно с
// воспроизведением, под видео — углы в текущий момент (текстом) и графики
// углов по всему видео. Клик по графику перематывает видео.

import { useEffect, useMemo, useRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { AdminButton } from '@/components/admin/ui';
import { ANGLE_LABELS, frameAngles, frameIndexAt, type AngleKey, type PoseReferenceDoc } from '@/lib/pose/reference';
import { containRect, drawSkeleton } from './draw';
import AngleChart from './AngleChart';

const LEFT = '#3987e5';
const RIGHT = '#d95926';

async function loadDoc(videoId: string): Promise<PoseReferenceDoc> {
  const res = await fetch(`/api/admin/pose-references/${videoId}/frames`, { cache: 'no-store' });
  if (!res.ok || !res.body) throw new Error('Не удалось загрузить эталон');
  const text = await new Response(res.body.pipeThrough(new DecompressionStream('gzip'))).text();
  return JSON.parse(text) as PoseReferenceDoc;
}

export default function ReferenceViewer({ videoId, playbackUrl }: { videoId: string; playbackUrl: string }) {
  const [doc, setDoc] = useState<PoseReferenceDoc | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSkeleton, setShowSkeleton] = useState(true);
  const [currentMs, setCurrentMs] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let cancelled = false;
    setDoc(null);
    setError(null);
    loadDoc(videoId)
      .then((d) => !cancelled && setDoc(d))
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : 'Ошибка'));
    return () => {
      cancelled = true;
    };
  }, [videoId]);

  // Углы по всем кадрам — один раз на документ
  const angles = useMemo(() => (doc ? doc.frames.map(frameAngles) : []), [doc]);
  const times = useMemo(() => (doc ? doc.frames.map((f) => f[0]!) : []), [doc]);
  // Серии для графиков — стабильные ссылки, иначе графики пересчитывались бы на каждом кадре видео
  const charts = useMemo(() => {
    const col = (key: AngleKey) => angles.map((a) => a[key]);
    return {
      knees: [
        { label: 'Левое', color: LEFT, values: col('kneeL') },
        { label: 'Правое', color: RIGHT, values: col('kneeR') },
      ],
      hips: [
        { label: 'Левый', color: LEFT, values: col('hipL') },
        { label: 'Правый', color: RIGHT, values: col('hipR') },
      ],
      trunk: [{ label: 'Корпус', color: LEFT, values: col('trunk') }],
    };
  }, [angles]);

  // Отрисовка скелета синхронно с видео
  useEffect(() => {
    if (!doc) return;
    let raf = 0;
    let lastIdx = -2;
    let lastSize = '';
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas) return;
      const ms = video.currentTime * 1000;
      const idx = frameIndexAt(doc.frames, ms);
      const dpr = window.devicePixelRatio || 1;
      const w = video.clientWidth;
      const h = video.clientHeight;
      const size = `${w}x${h}x${dpr}x${showSkeleton}`;
      if (idx === lastIdx && size === lastSize) return;
      lastIdx = idx;
      lastSize = size;
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const rect = containRect(w, h, video.videoWidth || doc.width, video.videoHeight || doc.height);
      drawSkeleton(ctx, showSkeleton ? doc.frames[idx] : undefined, rect, dpr);
      setCurrentMs(ms);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [doc, showSkeleton]);

  const seek = (ms: number) => {
    const v = videoRef.current;
    if (v) v.currentTime = ms / 1000;
  };

  const now = doc ? angles[frameIndexAt(doc.frames, currentMs)] : undefined;

  if (error) return <div style={{ color: 'var(--color-danger)', fontSize: 14 }}>{error}</div>;

  return (
    <div className="flex flex-col" style={{ gap: 16 }}>
      <div style={{ position: 'relative', width: '100%', aspectRatio: '16 / 9', background: '#000', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
        <video
          ref={videoRef}
          src={playbackUrl}
          controls
          playsInline
          preload="metadata"
          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
        />
        {/* Холст точно по размеру видео (иначе скелет съедет); клики проходят к контролам */}
        <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} />
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <AdminButton
          type="button"
          size="sm"
          tone="secondary"
          icon={showSkeleton ? EyeOff : Eye}
          aria-pressed={showSkeleton}
          onClick={() => setShowSkeleton((v) => !v)}
        >
          {showSkeleton ? 'Скрыть скелет' : 'Показать скелет'}
        </AdminButton>
        {!doc && <span style={{ color: 'var(--color-muted)', fontSize: 13 }}>Загружаю эталон…</span>}
      </div>

      {/* Углы в текущий момент — текстом (табличный вид графиков) */}
      {doc && now && (
        <div
          className="grid gap-2"
          style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))' }}
          aria-live="off"
        >
          {(Object.keys(ANGLE_LABELS) as AngleKey[]).map((k) => (
            <div
              key={k}
              style={{ background: 'var(--color-night)', border: '1px solid var(--border-hairline)', borderRadius: 8, padding: '8px 10px' }}
            >
              <div style={{ color: 'var(--color-muted)', fontSize: 12 }}>{ANGLE_LABELS[k]}</div>
              <div style={{ fontSize: 18, fontWeight: 800 }}>{now[k] != null ? `${now[k]}°` : '—'}</div>
            </div>
          ))}
        </div>
      )}

      {doc && (
        <div className="flex flex-col" style={{ gap: 20 }}>
          <AngleChart
            title="Колени"
            times={times}
            series={charts.knees}
            yMax={180}
            yTicks={[0, 45, 90, 135, 180]}
            currentMs={currentMs}
            durationMs={doc.durationMs}
            onSeek={seek}
          />
          <AngleChart
            title="Тазобедренные"
            times={times}
            series={charts.hips}
            yMax={180}
            yTicks={[0, 45, 90, 135, 180]}
            currentMs={currentMs}
            durationMs={doc.durationMs}
            onSeek={seek}
          />
          <AngleChart
            title="Наклон корпуса от вертикали"
            times={times}
            series={charts.trunk}
            yMax={90}
            yTicks={[0, 30, 60, 90]}
            currentMs={currentMs}
            durationMs={doc.durationMs}
            onSeek={seek}
          />
          <div style={{ color: 'var(--color-muted)', fontSize: 12, lineHeight: 1.5 }}>
            Углы считаются по 3D-точкам MediaPipe и гуляют на 10–20°: смотрите на форму движения, а не на точные
            градусы. Разрыв линии — сустав в этот момент не виден. 180° у колена — нога прямая.
          </div>
        </div>
      )}
    </div>
  );
}
