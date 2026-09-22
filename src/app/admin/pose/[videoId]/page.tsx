'use client';

import { use, useCallback, useEffect, useState } from 'react';
import { AdminPage, PageHeader, AdminCard, SectionTitle, AdminButton } from '@/components/admin/ui';
import { PersonStanding, RefreshCw } from 'lucide-react';
import ReferenceProcessor from '@/components/admin/pose/ReferenceProcessor';
import ReferenceViewer from '@/components/admin/pose/ReferenceViewer';

// Эталон движений одного видео: обработать (в браузере) или посмотреть.

interface Detail {
  video: { id: string; title: string; duration: number; trainer: { name: string; lastName: string } | null };
  sourceUrl: string;
  playbackUrl: string;
  reference: {
    model: string;
    fps: number;
    frameCount: number;
    durationSec: number;
    detectedRatio: number;
    legsVisibleRatio: number;
    updatedAt: string;
  } | null;
}

const pct = (x: number) => `${Math.round(x * 100)}%`;

export default function PoseReferencePage({ params }: { params: Promise<{ videoId: string }> }) {
  const { videoId } = use(params);
  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reprocess, setReprocess] = useState(false);

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

      {data && ref && !reprocess && (
        <div className="flex flex-col" style={{ gap: 16 }}>
          <AdminCard>
            <SectionTitle>Эталон</SectionTitle>
            <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', fontSize: 14 }}>
              <Stat label="Тренер найден" value={pct(ref.detectedRatio)} hint="доля кадров" />
              <Stat label="Ноги видны целиком" value={pct(ref.legsVisibleRatio)} hint="таз, колени, голеностопы" />
              <Stat label="Кадров" value={String(ref.frameCount)} hint={`${ref.fps} в секунду`} />
              <Stat
                label="Обработано"
                value={new Date(ref.updatedAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                hint={ref.model.replace('pose_landmarker_', 'модель ')}
              />
            </div>
          </AdminCard>
          <ReferenceViewer key={ref.updatedAt} videoId={videoId} playbackUrl={data.playbackUrl} />
          <div>
            <AdminButton type="button" tone="secondary" icon={RefreshCw} onClick={() => setReprocess(true)}>
              Обработать заново
            </AdminButton>
          </div>
        </div>
      )}

      {data && (!ref || reprocess) && (
        <AdminCard>
          <SectionTitle>{ref ? 'Обработать заново' : 'Обработать видео'}</SectionTitle>
          <p style={{ color: 'var(--color-muted)', fontSize: 14, lineHeight: 1.5, margin: '0 0 16px' }}>
            Браузер скачает видео, загрузит модель распознавания и пройдёт по видео 10 раз в секунду. На компьютере это
            примерно 1–2 минуты на минуту видео. Результат сохранится на платформе{ref ? ' и заменит текущий эталон' : ''}.
          </p>
          <ReferenceProcessor
            videoId={videoId}
            sourceUrl={data.sourceUrl}
            onDone={() => {
              setReprocess(false);
              void load();
            }}
          />
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
