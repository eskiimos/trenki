import { prisma } from '@/lib/prisma';
import type { MediaJob, MediaJobTarget } from '@/generated/prisma';
import { deleteS3ObjectsByUrls } from '@/lib/s3';

// Операции с очередью обработки видео из роутов (постановка, отмена, статусы).
// Сам воркер — src/lib/media/worker.ts.

/** Незавершённые задачи: их исходники ещё нужны или уже бесполезны при замене. */
const UNFINISHED = ['QUEUED', 'PROCESSING', 'FAILED'] as const;
const ACTIVE = ['QUEUED', 'PROCESSING'] as const;

export async function hasJobForSource(sourceUrl: string): Promise<boolean> {
  const job = await prisma.mediaJob.findFirst({ where: { sourceUrl }, select: { id: true } });
  return !!job;
}

/**
 * Поставить исходник в обработку для цели. Прежние незавершённые задачи этой
 * цели отменяются, их исходники удаляются из бакета (админ загрузил другой файл).
 */
export async function enqueueMediaJob(params: {
  targetType: MediaJobTarget;
  targetId: string;
  sourceUrl: string;
  publishOnReady: boolean;
}): Promise<MediaJob> {
  const previous = await prisma.mediaJob.findMany({
    where: { targetType: params.targetType, targetId: params.targetId, status: { in: [...UNFINISHED] } },
    select: { id: true, sourceUrl: true },
  });
  const [, job] = await prisma.$transaction([
    prisma.mediaJob.updateMany({
      // Статус в условии: задачу, которую воркер успел завершить, не отменяем.
      where: { id: { in: previous.map((p) => p.id) }, status: { in: [...UNFINISHED] } },
      data: { status: 'CANCELED', finishedAt: new Date() },
    }),
    prisma.mediaJob.create({ data: params }),
  ]);
  await deleteS3ObjectsByUrls(previous.map((p) => p.sourceUrl).filter((u) => u !== params.sourceUrl));
  return job;
}

/** Отменить незавершённые задачи цели и удалить их исходники (удаление цели, смена файла на ссылку). */
export async function cancelMediaJobsForTarget(targetType: MediaJobTarget, targetId: string): Promise<void> {
  const jobs = await prisma.mediaJob.findMany({
    where: { targetType, targetId, status: { in: [...UNFINISHED] } },
    select: { id: true, sourceUrl: true },
  });
  if (jobs.length === 0) return;
  await prisma.mediaJob.updateMany({
    where: { id: { in: jobs.map((j) => j.id) }, status: { in: [...UNFINISHED] } },
    data: { status: 'CANCELED', finishedAt: new Date() },
  });
  await deleteS3ObjectsByUrls(jobs.map((j) => j.sourceUrl));
}

/**
 * Запомнить, публиковать ли цель после обработки (админ сохранил карточку во
 * время обработки). FAILED тоже: «Повторить» применит актуальное намерение.
 */
export async function setPublishIntent(
  targetType: MediaJobTarget,
  targetId: string,
  publishOnReady: boolean,
): Promise<void> {
  await prisma.mediaJob.updateMany({
    where: { targetType, targetId, status: { in: [...UNFINISHED] } },
    data: { publishOnReady },
  });
}

export async function hasActiveJob(targetType: MediaJobTarget, targetId: string): Promise<boolean> {
  const job = await prisma.mediaJob.findFirst({
    where: { targetType, targetId, status: { in: [...ACTIVE] } },
    select: { id: true },
  });
  return !!job;
}

export interface MediaJobStatusView {
  id: string;
  status: MediaJob['status'];
  stage: string | null;
  progress: number;
  error: string | null;
  /** Намерение публикации: форма шортса показывает его, а не временный isPublished=false. */
  publishOnReady: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Последняя (не отменённая) задача по каждой цели — для бейджей в админке.
 * DONE старше суток не отдаём: «Обработано» админу интересно только сразу.
 */
export async function latestJobsByTarget(targetType: MediaJobTarget): Promise<Record<string, MediaJobStatusView>> {
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const jobs = await prisma.mediaJob.findMany({
    where: {
      targetType,
      status: { not: 'CANCELED' },
      OR: [{ status: { not: 'DONE' } }, { finishedAt: { gte: dayAgo } }],
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      targetId: true,
      status: true,
      stage: true,
      progress: true,
      error: true,
      publishOnReady: true,
      createdAt: true,
      updatedAt: true,
    },
    take: 500,
  });
  const result: Record<string, MediaJobStatusView> = {};
  for (const { targetId, ...view } of jobs) {
    if (!result[targetId]) result[targetId] = view;
  }
  return result;
}
