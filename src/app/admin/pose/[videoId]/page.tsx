'use client';

import { use, useCallback, useEffect, useState } from 'react';
import { AdminPage, PageHeader, AdminCard, SectionTitle, AdminButton, inputStyle } from '@/components/admin/ui';
import Link from 'next/link';
import { PersonStanding, RefreshCw, Camera } from 'lucide-react';
import ReferenceProcessor from '@/components/admin/pose/ReferenceProcessor';
import ReferenceViewer from '@/components/admin/pose/ReferenceViewer';
import BackgroundQueue from '@/components/admin/pose/BackgroundQueue';
import type { Segment } from '@/lib/pose/segments';
import { effectiveVideoTrackingEnabled, isTheoryVideo } from '@/lib/pose/coaching-settings';

// Эталон движений одного видео: обработать (в браузере) или посмотреть.

interface Detail {
  video: { id: string; title: string; duration: number; trainer: { name: string; lastName: string } | null; tags?: string[]; poseTrackingEnabled?: boolean | null; updatedAt?: string };
  sourceUrl: string;
  playbackUrl: string;
  reference: {
    model: string;
    fps: number;
    frameCount: number;
    durationSec: number;
    detectedRatio: number;
    legsVisibleRatio: number;
    segments: Segment[] | null;
    updatedAt: string;
  } | null;
}

const pct = (x: number) => `${Math.round(x * 100)}%`;

export default function PoseReferencePage({ params }: { params: Promise<{ videoId: string }> }) {
  const { videoId } = use(params);
  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reprocess, setReprocess] = useState(false);
  const [trackingDraft, setTrackingDraft] = useState<boolean | null | undefined>(undefined);
  const [savingTracking, setSavingTracking] = useState(false);
  const [trackingMessage, setTrackingMessage] = useState<{ error: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/pose-references/${videoId}`, { cache: 'no-store' });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d?.error || 'Не удалось загрузить видео');
      setData(d);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка');
    }
  }, [videoId]);

  useEffect(() => {
    void load();
  }, [load]);

  const ref = data?.reference;
  const savedTrackingMode = data?.video.poseTrackingEnabled ?? null;
  const selectedTrackingMode = trackingDraft === undefined ? savedTrackingMode : trackingDraft;
  const trackingEnabled = effectiveVideoTrackingEnabled(savedTrackingMode, data?.video.tags);
  const saveTracking = async () => {
    if (!data || trackingDraft === undefined || savingTracking) return;
    if (!data.video.updatedAt) { setTrackingMessage({ error: true, text: 'Обновите страницу, чтобы загрузить актуальную версию настроек видео.' }); return; }
    setSavingTracking(true); setTrackingMessage(null);
    try {
      const response = await fetch(`/api/admin/pose-references/${encodeURIComponent(videoId)}/coaching`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackingEnabled: trackingDraft, expectedUpdatedAt: data.video.updatedAt }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Не удалось сохранить настройки биомеханики');
      if (typeof result.updatedAt !== 'string' || ![true, false, null].includes(result.trackingEnabled)) throw new Error('Сервер вернул неполные настройки. Обновите страницу.');
      setData((previous) => previous ? { ...previous, video: { ...previous.video, poseTrackingEnabled: result.trackingEnabled, updatedAt: result.updatedAt } } : previous);
      setTrackingDraft(undefined);
      setTrackingMessage({ error: false, text: 'Настройки биомеханики видео сохранены' });
    } catch (failure) { setTrackingMessage({ error: true, text: failure instanceof Error ? failure.message : 'Не удалось сохранить настройки' }); }
    finally { setSavingTracking(false); }
  };

  return (
    <AdminPage width="narrow">
      <PageHeader
        title={data?.video.title ?? 'Эталон движений'}
        subtitle={data?.video.trainer ? `${data.video.trainer.name} ${data.video.trainer.lastName}` : undefined}
        icon={PersonStanding}
        backHref="/admin/pose"
        backLabel="Эталоны"
      />

      {error && (
        <AdminCard tone="danger">
          <span style={{ fontSize: 14, fontWeight: 700 }}>{error}</span>
        </AdminCard>
      )}
      {data && <div style={{ marginBottom: 16 }}><BackgroundQueue videoId={videoId} hasReference={!!ref} onDone={load} /></div>}
      {data && <div style={{ marginBottom: 16 }}><AdminCard>
        <SectionTitle>Биомеханика видео</SectionTitle>
        <label style={{ fontSize: 13 }}>Режим отслеживания
          <select aria-label="Биомеханика видео" disabled={savingTracking} value={selectedTrackingMode === null ? 'auto' : selectedTrackingMode ? 'on' : 'off'} style={{ ...inputStyle, marginTop: 6 }} onChange={(e) => {
            const next = e.target.value === 'auto' ? null : e.target.value === 'on';
            setTrackingDraft(next === savedTrackingMode ? undefined : next); setTrackingMessage(null);
          }}>
            <option value="auto">Автоматически по типу видео</option>
            <option value="on">Включена</option>
            <option value="off">Выключена · теория / без биомеханики</option>
          </select>
        </label>
        <p style={{ color: 'var(--color-muted)', fontSize: 12 }}>В автоматическом режиме тег «Теория» отключает биомеханику; остальные видео используют настройки отрезков. {savedTrackingMode === null && isTheoryVideo(data.video.tags) ? 'Это видео отмечено как теория.' : ''}</p>
        <p style={{ fontSize: 13, margin: '8px 0 12px' }}>Сейчас сохранено: <b>{trackingEnabled ? 'биомеханика включена' : 'просмотр без отслеживания и оценки'}</b>.</p>
        <div className="flex flex-wrap gap-2">
          <AdminButton type="button" size="sm" disabled={trackingDraft === undefined || savingTracking} onClick={() => void saveTracking()}>{savingTracking ? 'Сохраняю…' : 'Сохранить биомеханику видео'}</AdminButton>
          {trackingDraft !== undefined && <AdminButton type="button" size="sm" tone="secondary" disabled={savingTracking} onClick={() => { setTrackingDraft(undefined); setTrackingMessage(null); }}>Отменить выбор режима</AdminButton>}
        </div>
        {!trackingEnabled && !ref && <div style={{ marginTop: 12 }}>
          <Link href={`/admin/pose/test/${videoId}`} className="inline-flex items-center gap-2" style={{ color: 'var(--color-brand)', fontSize: 13, fontWeight: 700 }}>Смотреть тренировку без биомеханики</Link>
        </div>}
        {trackingMessage && <p role={trackingMessage.error ? 'alert' : 'status'} style={{ color: trackingMessage.error ? 'var(--color-danger)' : 'var(--color-brand)', fontSize: 13, marginBottom: 0 }}>{trackingMessage.text}</p>}
      </AdminCard></div>}

      {data && ref && !reprocess && (
        <div className="flex flex-col" style={{ gap: 16 }}>
          <AdminCard>
            <Link href={`/admin/pose/test/${videoId}`} className="inline-flex items-center gap-2" style={{ color: 'var(--color-brand)', fontWeight: 700, marginBottom: 16 }}>
              <Camera size={18} aria-hidden /> Проверить эталон с камерой
            </Link>
            <SectionTitle>Эталон</SectionTitle>
            <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', fontSize: 14 }}>
              <Stat label="Тренер найден" value={pct(ref.detectedRatio)} hint="доля кадров" />
              <Stat label="Ноги видны целиком" value={pct(ref.legsVisibleRatio)} hint="таз, колени, голеностопы" />
              <Stat label="Кадров" value={String(ref.frameCount)} hint={`${ref.fps} в секунду`} />
              <Stat
                label="Рабочих отрезков"
                value={String(ref.segments?.length ?? 0)}
                hint="упражнение без объяснений"
              />
              <Stat
                label="Обработано"
                value={new Date(ref.updatedAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                hint={ref.model.replace('pose_landmarker_', 'модель ')}
              />
            </div>
          </AdminCard>
          <ReferenceViewer
            key={ref.updatedAt}
            videoId={videoId}
            playbackUrl={data.playbackUrl}
            durationMs={Math.round(ref.durationSec * 1000)}
            segments={ref.segments ?? []}
            updatedAt={ref.updatedAt}
            trackingEnabled={trackingEnabled}
          />
          <div>
            <AdminButton type="button" tone="secondary" icon={RefreshCw} onClick={() => setReprocess(true)}>
              Ручной повторный анализ в браузере
            </AdminButton>
          </div>
        </div>
      )}

      {data && (!ref || reprocess) && (
        <AdminCard>
          <details>
          <summary style={{ cursor: 'pointer', fontSize: 14, fontWeight: 700 }}>Обработать в браузере вручную</summary>
          <p style={{ color: 'var(--color-muted)', fontSize: 14, lineHeight: 1.5, margin: '0 0 16px' }}>
            Браузер скачает видео, загрузит модель распознавания и пройдёт по видео 10 раз в секунду. На компьютере это
            примерно 1–2 минуты на минуту видео. Результат сохранится на платформе{ref ? ' и заменит текущий эталон вместе с разметкой и настройками оценки' : ''}.
          </p>
          <ReferenceProcessor
            videoId={videoId}
            sourceUrl={data.sourceUrl}
            onDone={() => {
              setReprocess(false);
              void load();
            }}
          />
          </details>
        </AdminCard>
      )}
    </AdminPage>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <div style={{ color: 'var(--color-muted)', fontSize: 12 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800 }}>{value}</div>
      {hint && <div style={{ color: 'var(--color-muted)', fontSize: 12 }}>{hint}</div>}
    </div>
  );
}
