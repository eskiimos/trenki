import type { PoseReferenceJob } from '@/generated/prisma';

export const POSE_LEASE_MS = 2 * 60_000;
export const POSE_MAX_ATTEMPTS = 3;
export const POSE_MAX_INTERRUPTIONS = 20;
export const POSE_MAX_VIDEO_BYTES = 5 * 1024 ** 3;

export function leaseWhere(job: Pick<PoseReferenceJob, 'id' | 'runToken'>) {
  return { id: job.id, status: 'PROCESSING' as const, runToken: job.runToken };
}

export function referenceSnapshotMatches(expected: Date | null, current: Date | null): boolean {
  return expected?.getTime() === current?.getTime();
}

export function jobCanResume(job: Pick<PoseReferenceJob, 'status' | 'attempts' | 'interruptions'>): boolean {
  return job.status === 'PROCESSING' ? job.interruptions < POSE_MAX_INTERRUPTIONS : job.attempts < POSE_MAX_ATTEMPTS;
}

export function poseRetryDelay(attempt: number): number {
  return Math.min(15 * 60_000, 60_000 * 5 ** Math.max(0, attempt - 1));
}

export function referenceAttemptKey(videoId: string, token: string): string {
  if (!/^[a-zA-Z0-9_-]+$/.test(videoId) || !/^[a-zA-Z0-9-]+$/.test(token)) throw new Error('Invalid reference identity');
  return `pose/references/${videoId}/${token}.json.gz`;
}
