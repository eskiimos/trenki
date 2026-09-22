import { isS3Url, s3KeyFromUrl } from '@/lib/s3';
import { RAW_UPLOAD_PREFIX } from '@/lib/media/url-plan';

// Какие видео можно обработать в браузере админа: файл в нашем хранилище
// (s3://…, кроме сырых исходников до перекодирования) или файл на нашем же
// домене (/video/…). Kinescope — чужой плеер во встроенном окне, к кадрам
// доступа нет.

export type ReferenceSource = { kind: 's3'; key: string } | { kind: 'local'; path: string };

export function referenceSource(videoUrl: string | null | undefined): ReferenceSource | null {
  if (!videoUrl) return null;
  if (isS3Url(videoUrl)) {
    if (videoUrl.startsWith(RAW_UPLOAD_PREFIX)) return null; // ещё не перекодировано
    const key = s3KeyFromUrl(videoUrl);
    return key ? { kind: 's3', key } : null;
  }
  // Относительный путь нашего сайта (не //host)
  if (videoUrl.startsWith('/') && !videoUrl.startsWith('//')) return { kind: 'local', path: videoUrl };
  return null;
}

/** Prisma-where тех же видео (для списка в админке). */
export const REFERENCE_ELIGIBLE_WHERE = {
  OR: [
    { AND: [{ videoUrl: { startsWith: 's3://' } }, { NOT: { videoUrl: { startsWith: RAW_UPLOAD_PREFIX } } }] },
    { AND: [{ videoUrl: { startsWith: '/' } }, { NOT: { videoUrl: { startsWith: '//' } } }] },
  ],
};
