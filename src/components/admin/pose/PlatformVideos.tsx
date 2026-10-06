'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Activity, ChevronRight, Search } from 'lucide-react';
import { AdminCard, AdminButton, EmptyState, inputStyle } from '@/components/admin/ui';

interface VideoRow {
  id: string;
  title: string;
  duration: number;
  isPublished: boolean;
  trainer: { name: string; lastName: string } | null;
  poseReference: { updatedAt: string; detectedRatio: number; legsVisibleRatio: number; frameCount: number } | null;
}

const mmss = (sec: number) => {
  const seconds = Math.max(0, Math.round(sec));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
};

export default function PlatformVideos({ scope, purpose = 'reference' }: { scope: 'references' | 'library'; purpose?: 'reference' | 'assessment' }) {
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<VideoRow[] | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestRef = useRef<AbortController | null>(null);

  const load = useCallback(async (cursor: string | null = null) => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true);
    setError(null);
    if (!cursor) {
      setRows(null);
      setNextCursor(null);
    }
    try {
      const params = new URLSearchParams({ scope, q: query.trim() });
      if (cursor) params.set('cursor', cursor);
      const res = await fetch(`/api/admin/pose-references?${params}`, { cache: 'no-store', signal: controller.signal });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Не удалось загрузить видео');
      if (controller.signal.aborted) return;
      setRows((previous) => cursor ? [...(previous ?? []), ...data.videos] : data.videos);
      setNextCursor(data.nextCursor);
    } catch (e) {
      if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Не удалось загрузить видео');
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [scope, query]);

  useEffect(() => {
    setRows(null);
    setNextCursor(null);
    setLoading(true);
    setError(null);
    const timer = setTimeout(() => void load(), query.trim() ? 300 : 0);
    return () => {
      clearTimeout(timer);
      requestRef.current?.abort();
    };
  }, [load, query]);

  return (
    <div className="flex flex-col" style={{ gap: 12 }}>
      <div style={{ position: 'relative' }}>
        <Search size={18} aria-hidden style={{ position: 'absolute', left: 14, top: 13, color: 'var(--color-muted)' }} />
        <input
          type="search"
          aria-label="Поиск видео по названию или тренеру"
          placeholder="Название видео или имя тренера"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ ...inputStyle, paddingLeft: 42 }}
        />
      </div>

      {error && (
        <AdminCard tone="danger" role="alert">
          <div style={{ fontSize: 14, marginBottom: 12 }}>{error}</div>
          <AdminButton type="button" tone="secondary" onClick={() => void load(nextCursor)} disabled={loading}>
            Попробовать снова
          </AdminButton>
        </AdminCard>
      )}
      {loading && rows === null && <p role="status" style={{ color: 'var(--color-muted)', fontSize: 14 }}>Загружаю видео…</p>}
      {!loading && !error && !nextCursor && rows?.length === 0 && (
        <EmptyState
          icon={Activity}
          title={query.trim() ? 'Видео не найдены' : scope === 'library' ? 'Нет готовых видео в S3' : 'Эталонов пока нет'}
          hint={query.trim()
            ? 'Попробуйте другое название или имя тренера'
            : scope === 'library'
              ? 'Добавьте видео файлом в разделе «Видео» и дождитесь обработки'
              : 'Нажмите «Добавить видео из платформы», выберите видео и запустите анализ'}
        />
      )}
      {rows?.map((video) => (
        <Link key={video.id} href={purpose === 'assessment' ? `/admin/pose/test/${video.id}` : `/admin/pose/${video.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
          <AdminCard style={{ padding: '12px 14px' }}>
            <div className="flex items-center gap-3">
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 700, overflowWrap: 'anywhere' }}>{video.title}</div>
                <div style={{ color: 'var(--color-muted)', fontSize: 12, marginTop: 4 }}>
                  {[video.trainer ? `${video.trainer.name} ${video.trainer.lastName}` : null, mmss(video.duration), video.isPublished ? null : 'не опубликовано']
                    .filter(Boolean).join(' · ')}
                </div>
                <div style={{ fontSize: 12, marginTop: 6, color: video.poseReference ? 'var(--color-brand)' : 'var(--color-muted)' }}>
                  {video.poseReference
                    ? `Эталон есть · тренер виден в ${Math.round(video.poseReference.detectedRatio * 100)}% кадров`
                    : 'Готово к анализу'}
                </div>
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-brand)', flexShrink: 0 }}>
                {purpose === 'assessment' ? 'Тест с камерой' : video.poseReference ? 'Открыть эталон' : 'Выбрать видео'}
              </span>
              <ChevronRight size={20} style={{ color: 'var(--color-muted)', flexShrink: 0 }} aria-hidden />
            </div>
          </AdminCard>
        </Link>
      ))}
      {nextCursor && (
        <div>
          <AdminButton type="button" tone="secondary" onClick={() => void load(nextCursor)} disabled={loading}>
            {loading ? 'Загружаю…' : 'Показать ещё'}
          </AdminButton>
        </div>
      )}
    </div>
  );
}
