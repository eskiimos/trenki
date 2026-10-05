'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Play, Square, RefreshCw } from 'lucide-react';
import { AdminButton, AdminCard, SectionTitle } from '@/components/admin/ui';

interface Job {
  id: string; videoId: string; status: 'QUEUED' | 'PROCESSING' | 'DONE' | 'FAILED' | 'CANCELED';
  stage: string | null; progress: number; error: string | null; retryAt: string | null;
  video: { title: string };
}
interface Queue { jobs: Job[]; counts: Record<string, number>; workerOnline: boolean }
const labels = { QUEUED: 'В очереди', PROCESSING: 'Обрабатывается', DONE: 'Эталон сохранён', FAILED: 'Ошибка', CANCELED: 'Отменено' };
const stages: Record<string, string> = { download: 'Скачивание видео', analyze: 'Распознавание движений', save: 'Сохранение эталона' };

export default function BackgroundQueue({ videoId, hasReference = false, onDone }: {
  videoId?: string; hasReference?: boolean; onDone?: () => void;
}) {
  const [data, setData] = useState<Queue | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const completed = useRef<string | null>(null);
  const doneCallback = useRef(onDone);
  useEffect(() => { doneCallback.current = onDone; }, [onDone]);
  useEffect(() => {
    let stopped = false;
    let controller: AbortController | null = null;
    let timer: ReturnType<typeof setTimeout>;
    const load = async () => {
      controller = new AbortController();
      try {
        const res = await fetch(`/api/admin/pose-jobs${videoId ? `?videoId=${encodeURIComponent(videoId)}` : ''}`, { cache: 'no-store', signal: controller.signal });
        const value = await res.json();
        if (!res.ok) throw new Error(value.error || 'Не удалось загрузить очередь');
        if (stopped) return;
        setData(value); setError(null);
        const signature = value.jobs.filter((j: Job) => j.status === 'DONE')
          .map((j: Job & { updatedAt: string }) => `${j.id}:${j.updatedAt}`).sort().join(',');
        if (completed.current !== null && signature && signature !== completed.current) doneCallback.current?.();
        completed.current = signature;
      } catch (e) { if (!stopped) setError(e instanceof Error ? e.message : 'Ошибка загрузки очереди'); }
      finally { if (!stopped) timer = setTimeout(() => void load(), 5000); }
    };
    completed.current = null;
    void load();
    return () => { stopped = true; controller?.abort(); clearTimeout(timer); };
  }, [videoId]);

  const act = useCallback(async (action: string, target = videoId, replace = hasReference) => {
    setBusy(true); setError(null); setMessage(null);
    try {
      const res = await fetch('/api/admin/pose-jobs', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, videoId: target, replace }) });
      const value = await res.json();
      if (!res.ok) throw new Error(value.error || 'Не удалось изменить очередь');
      setMessage(action === 'missing'
        ? `Добавлено: ${value.queued}. Уже в очереди: ${value.existing}. Готовые эталоны сохранены.`
        : action === 'cancel' ? 'Задача отменена' : value.status === 'ready' ? 'Эталон уже сохранён' : 'Задача поставлена в очередь. Можно закрыть страницу.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Ошибка очереди'); }
    finally { setBusy(false); }
  }, [videoId, hasReference]);
  const active = data?.jobs.some((j) => ['QUEUED', 'PROCESSING'].includes(j.status));
  const shown = videoId ? data?.jobs ?? [] : data?.jobs.filter((j) => ['QUEUED', 'PROCESSING', 'FAILED'].includes(j.status)) ?? [];
  const localJob = videoId ? data?.jobs[0] : undefined;
  return (
    <AdminCard>
      <SectionTitle>Фоновый анализ</SectionTitle>
      <p style={{ fontSize: 14, color: 'var(--color-muted)', margin: '0 0 12px' }}>
        Видео обрабатываются по одному на сервере. Вкладку можно закрыть.
      </p>
      {!videoId && data && <p style={{ fontSize: 13 }}>В очереди: {data.counts.QUEUED ?? 0} · Обрабатывается: {data.counts.PROCESSING ?? 0} · Готово: {data.counts.DONE ?? 0} · Ошибок: {data.counts.FAILED ?? 0}</p>}
      {data && !data.workerOnline && <p role="status" style={{ fontSize: 13, color: 'var(--color-muted)' }}>Фоновый обработчик пока не отвечает. Задачи сохраняются в очереди до его запуска.</p>}
      <AdminButton type="button" icon={localJob?.status === 'FAILED' ? RefreshCw : Play}
        disabled={busy || !data || (!!videoId && !!active)} onClick={() => void act(videoId ? 'enqueue' : 'missing')}>
        {busy ? 'Сохраняю…' : !videoId ? 'Обработать все занятия без эталонов' : hasReference ? 'Пересчитать эталон в фоне' : localJob?.status === 'FAILED' ? 'Повторить анализ' : 'Запустить анализ в фоне'}
      </AdminButton>
      {message && <p role="status" style={{ fontSize: 13 }}>{message}</p>}
      {error && <p role="alert" style={{ fontSize: 13, color: 'var(--color-danger)' }}>{error}</p>}
      <div className="flex flex-col" style={{ gap: 12, marginTop: 16 }}>
        {shown.map((job) => (
          <div key={job.id} style={{ borderTop: '1px solid var(--color-border)', paddingTop: 12 }}>
            {!videoId && <Link href={`/admin/pose/${job.videoId}`} style={{ fontSize: 14, fontWeight: 700 }}>{job.video.title}</Link>}
            <p role="status" style={{ fontSize: 13, margin: '4px 0' }}>{labels[job.status]}{job.status === 'PROCESSING' ? ` · ${stages[job.stage ?? ''] ?? 'Анализ'} · ${job.progress}%` : ''}</p>
            {job.status === 'PROCESSING' && <progress aria-label="Прогресс анализа" value={job.progress} max={100} style={{ width: '100%' }} />}
            {job.error && <p style={{ fontSize: 12, color: 'var(--color-muted)' }}>{job.error}</p>}
            {job.retryAt && job.status === 'QUEUED' && <p style={{ fontSize: 12 }}>Повтор после {new Date(job.retryAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</p>}
            {['QUEUED', 'PROCESSING'].includes(job.status) && <AdminButton type="button" tone="secondary" icon={Square} disabled={busy} onClick={() => void act('cancel', job.videoId)}>Отменить</AdminButton>}
            {!videoId && job.status === 'FAILED' && <AdminButton type="button" tone="secondary" icon={RefreshCw} disabled={busy} onClick={() => void act('enqueue', job.videoId, true)}>Повторить</AdminButton>}
          </div>
        ))}
      </div>
    </AdminCard>
  );
}
