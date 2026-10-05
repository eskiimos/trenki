import type { Prisma } from '@/generated/prisma';
import { getS3Config, s3KeyFromUrl, s3KeyFromPublicUrl } from '@/lib/s3';
import { RAW_UPLOAD_PREFIX } from '@/lib/media/url-plan';

// Какие видео можно обработать в браузере админа: файл в нашем хранилище
// (s3://… или HTTPS нашего бакета, кроме сырых исходников) или файл на нашем же
// домене (/video/…). Kinescope — чужой плеер во встроенном окне, к кадрам
// доступа нет.

export type ReferenceSource = { kind: 's3'; key: string } | { kind: 'local'; path: string };

export function referenceSource(videoUrl: string | null | undefined): ReferenceSource | null {
  if (!videoUrl) return null;
  let key: string | null;
  try {
    key = s3KeyFromUrl(videoUrl) ?? s3KeyFromPublicUrl(videoUrl);
  } catch {
    return null; // повреждённое URL-кодирование
  }
  if (key) {
    if (key.startsWith('uploads/')) return null; // ещё не перекодировано
    return { kind: 's3', key };
  }
  // Относительный путь нашего сайта (не //host)
  if (videoUrl.startsWith('/') && !videoUrl.startsWith('//')) return { kind: 'local', path: videoUrl };
  return null;
}

/** Prisma-where тех же видео (для списка в админке). */
export function referenceEligibleWhere(s3Only = false): Prisma.VideoWhereInput {
  const sources: Prisma.VideoWhereInput[] = [
    { AND: [{ videoUrl: { startsWith: 's3://' } }, { NOT: { videoUrl: { startsWith: RAW_UPLOAD_PREFIX } } }] },
  ];
  const config = getS3Config();
  if (config) {
    const prefix = `${config.endpoint}/${config.bucket}/`;
    sources.push({
      AND: [{ videoUrl: { startsWith: prefix } }, { NOT: { videoUrl: { startsWith: `${prefix}uploads/` } } }],
    });
  }
  if (!s3Only) {
    sources.push({ AND: [{ videoUrl: { startsWith: '/' } }, { NOT: { videoUrl: { startsWith: '//' } } }] });
  }
  return { OR: sources };
}
