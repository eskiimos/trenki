'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Clock, Loader2, RotateCcw, X } from 'lucide-react';
import { AdminButton } from '@/components/admin/ui';

// Общее для админки видео и шортсов: заливка файла в S3 по presigned PUT и
// статусы серверной обработки (src/lib/media/worker.ts).

export interface MediaJobView {
  id: string;
  status: 'QUEUED' | 'PROCESSING' | 'DONE' | 'FAILED' | 'CANCELED';
  stage: string | null;
  progress: number;
  error: string | null;
  /** Опубликовать после обработки (то, что админ выбрал в форме). */
  publishOnReady: boolean;
}

export const isJobActive = (job: MediaJobView | undefined | null): boolean =>
  !!job && (job.status === 'QUEUED' || job.status === 'PROCESSING');

export const isAbortError = (error: unknown): boolean =>
  error instanceof DOMException ? error.name === 'AbortError' : (error as Error)?.name === 'AbortError';

// iOS/Windows иногда отдают пустой file.type — подставляем по расширению
// (сервер проверяет только префикс video/ или image/).
const TYPE_BY_EXT: Record<string, string> = {
  mp4: 'video/mp4',
  m4v: 'video/x-m4v',
  mov: 'video/quicktime',
  webm: 'video/webm',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

/* ─── Wake Lock ─────────────────────────────────────────────────────────────
   На iPhone блокировка экрана или сворачивание Safari обрывает XHR, и
   гигабайтный файл начинает заливаться с нуля. Safari выдаёт Wake Lock только
   по свежему жесту пользователя — поэтому запрашиваем его в onClick кнопки
   выбора файла, а не после выбора (пикер и «подготовка» файла идут дольше
   окна активации). При возврате на вкладку во время заливки — запрашиваем снова. */

type Sentinel = { release: () => Promise<void>; addEventListener: (t: 'release', cb: () => void) => void };
let wakeLock: Sentinel | null = null;
let wakeLockPending = false;
let wakeLockTimer: ReturnType<typeof setTimeout> | null = null;
let activeUploads = 0;

function requestWakeLock(): void {
  const api = (navigator as any).wakeLock;
  if (!api || wakeLock || wakeLockPending) return;
  wakeLockPending = true;
  // request() вызывается синхронно в обработчике жеста (до первого await).
  api
    .request('screen')
    .then((sentinel: Sentinel) => {
      wakeLockPending = false;
      // Пока ждали ответ, заливка закончилась и выбор файла не ждём — не держим экран.
      if (wakeLock || (activeUploads === 0 && !wakeLockTimer)) {
        sentinel.release().catch(() => {});
        return;
      }
      wakeLock = sentinel;
      sentinel.addEventListener('release', () => {
        if (wakeLock === sentinel) wakeLock = null;
      });
    })
    .catch(() => {
      wakeLockPending = false;
      /* не поддерживается или отказано — заливка идёт и без него */
    });
}

function releaseWakeLock(): void {
  wakeLock?.release().catch(() => {});
  wakeLock = null;
}

/** Вызывать в onClick кнопки выбора видеофайла. */
export function acquireUploadWakeLock(): void {
  requestWakeLock();
  if (wakeLockTimer) clearTimeout(wakeLockTimer);
  // Выбор файла отменили — не держим экран включённым вечно. С запасом: iOS
  // готовит длинное видео из «Фото» (выгрузка из iCloud, сжатие) минутами.
  wakeLockTimer = setTimeout(() => {
    wakeLockTimer = null;
    if (activeUploads === 0) releaseWakeLock();
  }, 20 * 60_000);
}

/**
 * Загрузка файла в наше S3. kind=video|short → сырой исходник, возвращает
 * s3://uploads/...; kind=thumbnail → публичный https. Бросает Error с текстом
 * для админа или AbortError при отмене через signal.
 */
export async function uploadFileToS3(
  file: File,
  kind: 'video' | 'short' | 'thumbnail',
  onProgress: (percent: number) => void,
  signal?: AbortSignal,
): Promise<string> {
  let videoUrl = '';
  const ext = file.name.includes('.') ? file.name.split('.').pop()!.toLowerCase() : '';
  const contentType = file.type || TYPE_BY_EXT[ext] || (kind === 'thumbnail' ? 'image/jpeg' : 'video/mp4');

  const isVideo = kind !== 'thumbnail';
  const onVisible = () => {
    if (document.visibilityState === 'visible') requestWakeLock();
  };
  if (isVideo) {
    // Заливка началась: таймер «выбор отменили» больше не нужен, лок держим
    // до конца (и перезапрашиваем — WebKit помнит разрешение документа).
    if (wakeLockTimer) {
      clearTimeout(wakeLockTimer);
      wakeLockTimer = null;
    }
    activeUploads++;
    requestWakeLock();
    document.addEventListener('visibilitychange', onVisible);
  }

  try {
    const initRes = await fetch('/api/admin/s3/upload-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName: file.name, contentType, kind, fileSize: file.size }),
      signal,
    });
    const init = await initRes.json().catch(() => ({}));
    if (!initRes.ok) throw new Error(init.error || `HTTP ${initRes.status}`);
    const { uploadUrl, acl } = init as { uploadUrl: string; acl?: string };
    videoUrl = init.videoUrl;

    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const onAbort = () => xhr.abort();
      signal?.addEventListener('abort', onAbort, { once: true });
      const done = () => signal?.removeEventListener('abort', onAbort);
      xhr.open('PUT', uploadUrl);
      xhr.setRequestHeader('Content-Type', contentType);
      if (acl) xhr.setRequestHeader('x-amz-acl', acl);
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
      };
      xhr.onload = () => {
        done();
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else reject(new Error(`хранилище ответило ${xhr.status}`));
      };
      xhr.onabort = () => {
        done();
        reject(new DOMException('Загрузка отменена', 'AbortError'));
      };
      xhr.onerror = () => {
        done();
        reject(new Error('соединение прервалось (не блокируйте экран и не сворачивайте браузер во время загрузки)'));
      };
      xhr.send(file);
    });
  } finally {
    if (isVideo) {
      activeUploads--;
      document.removeEventListener('visibilitychange', onVisible);
      if (activeUploads === 0) releaseWakeLock();
    }
  }
  return videoUrl;
}

/** Ref текущей заливки, которая отменяется при уходе со страницы (Link, «назад», свайп). */
export function useUploadAbortRef() {
  const ref = useRef<AbortController | null>(null);
  useEffect(() => () => ref.current?.abort(), []);
  return ref;
}

/**
 * Предупреждение при уходе со страницы, пока идёт заливка или файл не сохранён:
 * beforeunload (закрытие/перезагрузка на десктопе) и перехват внутренних ссылок
 * (переходы Next <Link> beforeunload не вызывают). iOS Safari beforeunload не
 * поддерживает — там спасает только перехват ссылок.
 */
export function useLeaveWarning(active: boolean, message = 'Файл ещё не сохранён — уйти со страницы?') {
  useEffect(() => {
    if (!active) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const link = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!link || link.target === '_blank' || link.origin !== window.location.origin) return;
      if (!window.confirm(message)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    // capture на document срабатывает раньше обработчика React у <Link>
    document.addEventListener('click', onClick, true);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      document.removeEventListener('click', onClick, true);
    };
  }, [active, message]);
}

const POLL_MS = 10_000;

/**
 * Статусы обработки по целям. Пока что-то в очереди/обрабатывается — поллим;
 * когда задача завершилась, зовём onSettled (перечитать список: videoUrl,
 * длительность, публикация поменялись на сервере).
 */
export function useMediaJobs(targetType: 'VIDEO' | 'SHORT', onSettled: (settledIds: string[]) => void) {
  const [jobs, setJobs] = useState<Record<string, MediaJobView>>({});
  const jobsRef = useRef(jobs);
  jobsRef.current = jobs;
  const activeRef = useRef<Set<string>>(new Set());
  const pendingRef = useRef<Set<string>>(new Set());
  const onSettledRef = useRef(onSettled);
  onSettledRef.current = onSettled;

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/media-jobs?targetType=${targetType}`, { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      const next: Record<string, MediaJobView> = data.jobs || {};
      const nowActive = new Set(Object.keys(next).filter((id) => isJobActive(next[id])));
      const settledIds = [...activeRef.current].filter((id) => !nowActive.has(id));
      activeRef.current = nowActive;
      setJobs(next);
      if (settledIds.length > 0) onSettledRef.current(settledIds);
    } catch {
      /* статус — вспомогательный, список работает и без него */
    }
  }, [targetType]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const hasActive = Object.values(jobs).some(isJobActive);
  useEffect(() => {
    if (!hasActive) return;
    const timer = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(timer);
  }, [hasActive, refresh]);

  // Действие над упавшей задачей: без повторных нажатий, 409 (уже сделано
  // другим нажатием/вкладкой) — молча обновляем статусы.
  const act = useCallback(
    async (jobId: string, action: 'retry' | 'dismiss', fallbackError: string) => {
      if (pendingRef.current.has(jobId)) return;
      pendingRef.current.add(jobId);
      // Снимок — синхронно (updater setState React выполняет позже).
      const snapshot = jobsRef.current[jobId];
      const rollback = () => setJobs((prev) => (snapshot ? { ...prev, [jobId]: snapshot } : prev));
      if (snapshot) {
        setJobs((prev) => ({
          ...prev,
          [jobId]: { ...snapshot, status: action === 'retry' ? 'QUEUED' : 'CANCELED', error: null },
        }));
      }
      try {
        const res = await fetch(`/api/admin/media-jobs/${jobId}/${action}`, { method: 'POST' });
        if (!res.ok && !(action === 'retry' && res.status === 409)) {
          const data = await res.json().catch(() => ({}));
          rollback();
          alert(data.error || fallbackError);
        }
      } catch {
        rollback();
        alert(`${fallbackError} (нет связи)`);
      } finally {
        pendingRef.current.delete(jobId);
        await refresh();
      }
    },
    [refresh],
  );
  const retry = useCallback((jobId: string) => act(jobId, 'retry', 'Не удалось перезапустить обработку'), [act]);
  const dismiss = useCallback((jobId: string) => act(jobId, 'dismiss', 'Не удалось отменить замену файла'), [act]);

  return { jobs, refresh, retry, dismiss };
}

const STAGE_LABEL: Record<string, string> = {
  download: 'подготовка',
  probe: 'анализ файла',
  transcode: 'сжатие',
  remux: 'оптимизация',
  thumbnail: 'обложка',
  upload: 'сохранение',
};

/** Бейдж статуса обработки (для активной или упавшей задачи). */
export function MediaJobBadge({ job }: { job: MediaJobView | undefined }) {
  if (!job || (job.status !== 'QUEUED' && job.status !== 'PROCESSING' && job.status !== 'FAILED')) return null;
  const failed = job.status === 'FAILED';
  const Icon = failed ? AlertTriangle : job.status === 'QUEUED' ? Clock : Loader2;
  const label = failed
    ? 'Ошибка обработки'
    : job.status === 'QUEUED'
      ? 'В очереди на обработку'
      : `Обработка${job.stage && STAGE_LABEL[job.stage] ? ` · ${STAGE_LABEL[job.stage]}` : ''}${
          job.stage === 'transcode' || job.stage === 'remux' ? ` ${job.progress}%` : ''
        }`;
  return (
    <span
      className="shrink-0 inline-flex items-center gap-1"
      style={{
        fontSize: 12,
        fontWeight: 700,
        padding: '4px 12px',
        borderRadius: 'var(--radius-pill)',
        background: failed ? 'rgba(255,140,74,0.12)' : 'rgba(174,171,187,0.15)',
        color: failed ? 'var(--color-danger)' : 'var(--color-ink)',
      }}
    >
      <Icon size={16} className={job.status === 'PROCESSING' ? 'animate-spin' : undefined} aria-hidden />
      {label}
    </span>
  );
}

/**
 * Текст ошибки обработки + «Повторить». onDismiss — только когда у карточки
 * есть рабочий файл (упала замена): «Оставить текущий файл».
 */
export function MediaJobError({
  job,
  onRetry,
  onDismiss,
}: {
  job: MediaJobView | undefined;
  onRetry: (id: string) => void;
  onDismiss?: (id: string) => void;
}) {
  if (!job || job.status !== 'FAILED') return null;
  return (
    <div
      className="flex flex-wrap items-center gap-2"
      style={{
        marginTop: 12,
        padding: 12,
        borderRadius: 'var(--radius-md)',
        background: 'rgba(255,140,74,0.12)',
        border: '1px solid rgba(255,140,74,0.30)',
        fontSize: 13,
        color: 'var(--color-danger)',
      }}
    >
      <AlertTriangle size={16} style={{ flexShrink: 0 }} aria-hidden />
      <span style={{ flex: '1 1 200px' }}>{job.error || 'Не удалось обработать видео'}</span>
      <AdminButton type="button" size="sm" tone="secondary" icon={RotateCcw} onClick={() => onRetry(job.id)}>
        Повторить
      </AdminButton>
      {onDismiss && (
        <AdminButton type="button" size="sm" tone="secondary" icon={X} onClick={() => onDismiss(job.id)}>
          Оставить текущий файл
        </AdminButton>
      )}
    </div>
  );
}
