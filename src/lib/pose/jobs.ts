import { prisma } from '@/lib/prisma';
import { getS3Config } from '@/lib/s3';
import { referenceEligibleWhere, referenceSource } from './reference-source';

export const POSE_JOB_SELECT = {
  id: true, videoId: true, status: true, stage: true, progress: true,
  attempts: true, interruptions: true, error: true, retryAt: true,
  heartbeatAt: true, updatedAt: true,
} as const;

export class PoseQueueError extends Error {
  constructor(message: string, readonly status: number = 400) { super(message); }
}

/** One row per video; lock the video to serialize concurrent enqueue requests. */
export async function enqueuePoseJob(videoId: string, replace = false): Promise<'queued' | 'existing' | 'ready'> {
  if (!getS3Config()) throw new PoseQueueError('S3 не настроен', 503);
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM videos WHERE id = ${videoId} FOR UPDATE`;
    const video = await tx.video.findUnique({ where: { id: videoId }, select: {
      videoUrl: true, poseReference: { select: { updatedAt: true } },
    } });
    if (!video) throw new PoseQueueError('Видео не найдено', 404);
    const source = referenceSource(video.videoUrl);
    if (source?.kind !== 's3') throw new PoseQueueError('Нужен готовый файл видео в S3');
    const job = await tx.poseReferenceJob.findUnique({ where: { videoId } });
    if (job && ['QUEUED', 'PROCESSING'].includes(job.status)) return 'existing';
    if (video.poseReference && !replace) return 'ready';
    const data = {
      sourceUrl: video.videoUrl,
      referenceUpdatedAt: video.poseReference?.updatedAt ?? null,
      status: 'QUEUED' as const, stage: null, progress: 0, attempts: 0,
      interruptions: 0, runToken: null, error: null, retryAt: null,
      heartbeatAt: null, startedAt: null, finishedAt: null,
    };
    await tx.poseReferenceJob.upsert({ where: { videoId }, create: { videoId, ...data }, update: data });
    return 'queued';
  });
}

/** Bulk means the complete catalog, independently of UI search/pagination. */
export async function enqueueMissingPoseJobs() {
  if (!getS3Config()) throw new PoseQueueError('S3 не настроен', 503);
  const videos = await prisma.video.findMany({
    where: { AND: [referenceEligibleWhere(true), { poseReference: { is: null } }] },
    select: { id: true, videoUrl: true }, orderBy: { createdAt: 'asc' },
  });
  const result = { queued: 0, existing: 0, ready: 0, rejected: 0 };
  for (const video of videos) {
    if (referenceSource(video.videoUrl)?.kind !== 's3') { result.rejected++; continue; }
    try { result[await enqueuePoseJob(video.id)]++; }
    catch (error) { if (error instanceof PoseQueueError && error.status !== 503) result.rejected++; else throw error; }
  }
  return result;
}

export async function cancelPoseJob(videoId: string) {
  await prisma.poseReferenceJob.updateMany({
    where: { videoId, status: { in: ['QUEUED', 'PROCESSING'] } },
    data: { status: 'CANCELED', runToken: null, finishedAt: new Date(), stage: null },
  });
}
