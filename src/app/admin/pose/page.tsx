'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AdminPage, PageHeader, AdminCard, EmptyState } from '@/components/admin/ui';
import { Activity, ChevronRight, PersonStanding } from 'lucide-react';

// Эталоны движений тренеров (пилот трекинга): список видео, которые лежат
// файлом в нашем хранилище, и есть ли у них эталон. Только админ.

interface Row {
  id: string;
  title: string;
  duration: number;
  isPublished: boolean;
  trainer: { name: string; lastName: string } | null;
  poseReference: { updatedAt: string; detectedRatio: number; legsVisibleRatio: number; frameCount: number } | null;
}

const mmss = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`;
const pct = (x: number) => `${Math.round(x * 100)}%`;

export default function PoseReferencesPage() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/pose-references', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setRows(d.videos))
      .catch(() => setError('Не удалось загрузить список'));
  }, []);

  return (
    <AdminPage width="narrow">
      <PageHeader title="Эталоны движений" icon={PersonStanding} backHref="/admin" />
      <p style={{ color: 'var(--color-muted)', fontSize: 14, lineHeight: 1.5, margin: '0 0 24px' }}>
        Пилот трекинга: видео тренера прогоняется через распознавание позы (MediaPipe от Google), и его скелет по
        кадрам сохраняется как эталон. Обработка идёт в вашем браузере — лучше с компьютера. Доступны видео, которые
        лежат файлом в нашем хранилище (Kinescope — нет).
      </p>

      {error && (
        <AdminCard tone="danger">
          <span style={{ fontSize: 14, fontWeight: 700 }}>{error}</span>
        </AdminCard>
      )}
      {rows && rows.length === 0 && (
        <EmptyState icon={Activity} title="Нет видео в нашем хранилище" hint="Залейте видео файлом в разделе «Видео»" />
      )}
      {rows && rows.length > 0 && (
        <div className="flex flex-col" style={{ gap: 8 }}>
          {rows.map((v) => (
            <Link key={v.id} href={`/admin/pose/${v.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
              <AdminCard style={{ padding: '12px 14px' }}>
                <div className="flex items-center gap-3">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {v.title}
                    </div>
                    <div style={{ color: 'var(--color-muted)', fontSize: 12, marginTop: 2 }}>
                      {[v.trainer ? `${v.trainer.name} ${v.trainer.lastName}` : null, mmss(v.duration), v.isPublished ? null : 'не опубликовано']
                        .filter(Boolean)
                        .join(' · ')}
                    </div>
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, textAlign: 'right', flexShrink: 0 }}>
                    {v.poseReference ? (
                      <span style={{ color: 'var(--color-brand)' }}>
                        Эталон есть · тренер виден {pct(v.poseReference.detectedRatio)}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--color-muted)' }}>Нет эталона</span>
                    )}
                  </div>
                  <ChevronRight size={20} style={{ color: 'var(--color-muted)', flexShrink: 0 }} aria-hidden />
                </div>
              </AdminCard>
            </Link>
          ))}
        </div>
      )}
    </AdminPage>
  );
}
