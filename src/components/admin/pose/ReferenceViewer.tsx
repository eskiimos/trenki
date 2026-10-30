'use client';

// Просмотр эталона движений: видео тренера, поверх — его скелет синхронно с
// воспроизведением, под видео — углы в текущий момент (текстом) и графики
// углов по всему видео. Клик по графику перематывает видео.

import { useEffect, useMemo, useRef, useState } from 'react';
import { Eye, EyeOff, RotateCcw, RotateCw } from 'lucide-react';
import { AdminButton } from '@/components/admin/ui';
import { ANGLE_LABELS, frameAngles, frameIndexAt, type AngleKey, type PoseReferenceDoc } from '@/lib/pose/reference';
import { detectSegments, type Segment } from '@/lib/pose/segments';
import { clampReferenceSeek } from '@/lib/pose/reference-playback';
import { formatSegmentTime } from '@/lib/pose/segment-editor';
import { assessmentPreset, visibleAssessmentPoints } from '@/lib/pose/assessment-settings';
import { containRect, drawSkeleton } from './draw';
import AngleChart from './AngleChart';
import SegmentTimeline from './SegmentTimeline';

const LEFT = '#3987e5';
const RIGHT = '#d95926';

async function loadDoc(videoId: string): Promise<PoseReferenceDoc> {
  const res = await fetch(`/api/admin/pose-references/${videoId}/frames`, { cache: 'no-store' });
  if (!res.ok || !res.body) throw new Error('Не удалось загрузить эталон');
  const text = await new Response(res.body.pipeThrough(new DecompressionStream('gzip'))).text();
  return JSON.parse(text) as PoseReferenceDoc;
}

export default function ReferenceViewer({
  videoId,
  playbackUrl,
  durationMs,
  segments,
  updatedAt,
  trackingEnabled = true,
}: {
  videoId: string;
  playbackUrl: string;
  durationMs: number;
  segments: Segment[];
  updatedAt: string;
  trackingEnabled?: boolean;
}) {
  const [loadedDoc, setLoadedDoc] = useState<{ videoId: string; doc: PoseReferenceDoc } | null>(null);
  const doc = loadedDoc?.videoId === videoId ? loadedDoc.doc : null;
  const [error, setError] = useState<string | null>(null);
  const [showSkeleton, setShowSkeleton] = useState(true);
  const [currentMs, setCurrentMs] = useState(0);
  const [mediaReady, setMediaReady] = useState(false);
  const [workingSegments, setWorkingSegments] = useState(segments);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const versionRef = useRef(updatedAt);
  useEffect(() => { setWorkingSegments(segments); }, [segments]);

  useEffect(() => {
    let cancelled = false;
    loadDoc(videoId)
      .then((d) => { if (!cancelled) { setLoadedDoc({ videoId, doc: d }); setError(null); } })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : 'Ошибка'));
    return () => {
      cancelled = true;
    };
  }, [videoId]);

  // Углы по всем кадрам — один раз на документ
  const angles = useMemo(() => (doc ? doc.frames.map(frameAngles) : []), [doc]);
  const times = useMemo(() => (doc ? doc.frames.map((f) => f[0]!) : []), [doc]);
  const selectedAngles = useMemo(() => {
    let segmentIndex = 0;
    const defaults = assessmentPreset();
    return (doc?.frames ?? []).map((frame, index) => {
      while (segmentIndex < workingSegments.length && frame[0] >= workingSegments[segmentIndex].endMs) segmentIndex++;
      const segment = workingSegments[segmentIndex];
      const settings = segment?.assessment ?? defaults;
      const active = trackingEnabled && !!segment && frame[0] >= segment.startMs && frame[0] < segment.endMs && settings.enabled !== false;
      const included = Object.fromEntries((Object.keys(ANGLE_LABELS) as AngleKey[]).map((key) => [key, active && settings.weights[key] > 0])) as Record<AngleKey, boolean>;
      const values = Object.fromEntries((Object.keys(ANGLE_LABELS) as AngleKey[]).map((key) => [key, included[key] ? angles[index]?.[key] ?? null : null])) as Record<AngleKey, number | null>;
      return { included, values };
    });
  }, [angles, doc, workingSegments, trackingEnabled]);
  // Серии для графиков — стабильные ссылки, иначе графики пересчитывались бы на каждом кадре видео
  const charts = useMemo(() => {
    const col = (key: AngleKey) => selectedAngles.map((a) => a.values[key]);
    const excluded = (key: AngleKey) => selectedAngles.map((a) => !a.included[key]);
    return {
      knees: [
        { label: 'Левое', color: LEFT, values: col('kneeL'), excluded: excluded('kneeL') },
        { label: 'Правое', color: RIGHT, values: col('kneeR'), excluded: excluded('kneeR') },
      ],
      hips: [
        { label: 'Левый', color: LEFT, values: col('hipL'), excluded: excluded('hipL') },
        { label: 'Правый', color: RIGHT, values: col('hipR'), excluded: excluded('hipR') },
      ],
      trunk: [{ label: 'Корпус', color: LEFT, values: col('trunk'), excluded: excluded('trunk') }],
    };
  }, [selectedAngles]);

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
      const segment = workingSegments.find((part) => ms >= part.startMs && ms < part.endMs);
      const settings = segment?.assessment ?? assessmentPreset();
      const allowed = trackingEnabled && segment && settings.enabled !== false ? visibleAssessmentPoints(settings) : [];
      drawSkeleton(ctx, showSkeleton ? doc.frames[idx] : undefined, rect, dpr, [], allowed);
      setCurrentMs(ms);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [doc, showSkeleton, workingSegments, trackingEnabled]);

  const getCurrentMs = () => {
    const v = videoRef.current;
    return v && v.readyState >= 1 ? clampReferenceSeek(v.currentTime * 1000, durationMs, v.duration) : null;
  };

  const syncCurrentTime = () => setCurrentMs(getCurrentMs() ?? 0);

  const seek = (ms: number) => {
    const v = videoRef.current;
    if (!v || v.readyState < 1) return;
    v.currentTime = clampReferenceSeek(ms, durationMs, v.duration) / 1000;
    syncCurrentTime();
  };

  const now = doc ? selectedAngles[frameIndexAt(doc.frames, currentMs)] : undefined;

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
          onLoadedMetadata={() => { setMediaReady(true); syncCurrentTime(); }}
          onEmptied={() => { setMediaReady(false); setCurrentMs(0); }}
          onTimeUpdate={syncCurrentTime}
          onSeeking={syncCurrentTime}
          onSeeked={syncCurrentTime}
          onEnded={syncCurrentTime}
          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
        />
        {/* Холст точно по размеру видео (иначе скелет съедет); клики проходят к контролам */}
        <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} />
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap" role="group" aria-label="Перемотка видео">
          <AdminButton type="button" size="sm" tone="secondary" icon={RotateCcw} aria-label="Назад на 5 секунд" disabled={!mediaReady} onClick={() => seek((getCurrentMs() ?? 0) - 5000)}>−5 сек</AdminButton>
          <AdminButton type="button" size="sm" tone="secondary" icon={RotateCw} aria-label="Вперёд на 5 секунд" disabled={!mediaReady} onClick={() => seek((getCurrentMs() ?? 0) + 5000)}>+5 сек</AdminButton>
          <span data-testid="reference-current-time" style={{ color: 'var(--color-muted)', fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>{formatSegmentTime(currentMs)}</span>
        </div>
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

      {/* Рабочие отрезки: что учитывать в оценке, а что — объяснения */}
      <SegmentTimeline
        durationMs={durationMs}
        initial={segments}
        onChange={setWorkingSegments}
        currentMs={currentMs}
        getCurrentMs={getCurrentMs}
        playbackReady={mediaReady}
        onSeek={seek}
        onAuto={doc ? () => detectSegments(doc.frames, doc.durationMs) : null}
        onSave={async (next) => {
          try {
            const res = await fetch(`/api/admin/pose-references/${videoId}/segments`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ segments: next, expectedUpdatedAt: versionRef.current }),
            });
            const d = await res.json().catch(() => ({}));
            if (res.ok && typeof d.updatedAt === 'string') versionRef.current = d.updatedAt;
            return res.ok ? null : d?.error || 'Не удалось сохранить разметку';
          } catch {
            return 'Сетевая ошибка';
          }
        }}
      />

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
              <div style={{ fontSize: 18, fontWeight: 800 }}>{now.values[k] != null ? `${now.values[k]}°` : '—'}</div>
              {!now.included[k] && <div style={{ color: 'var(--color-muted)', fontSize: 11 }}>Не учитывается</div>}
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
            segments={workingSegments}
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
            segments={workingSegments}
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
            segments={workingSegments}
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
