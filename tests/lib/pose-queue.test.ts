import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import type { PoseReferenceJob } from '@/generated/prisma';

const mocks = vi.hoisted(() => ({
  admin: vi.fn(), transaction: vi.fn(), raw: vi.fn(), video: vi.fn(), videos: vi.fn(),
  job: vi.fn(), jobs: vi.fn(), upsert: vi.fn(), updateMany: vi.fn(), update: vi.fn(),
  reference: vi.fn(), group: vi.fn(), state: vi.fn(), head: vi.fn(),
}));
const tx = {
  $queryRaw: mocks.raw, video: { findUnique: mocks.video },
  poseReferenceJob: { findUnique: mocks.job, findFirst: mocks.job, upsert: mocks.upsert, updateMany: mocks.updateMany, update: mocks.update },
  poseReference: { upsert: mocks.reference },
};
vi.mock('@/lib/prisma', () => ({ prisma: {
  $transaction: mocks.transaction, video: { findUnique: mocks.video, findMany: mocks.videos },
  poseReferenceJob: { findUnique: mocks.job, findFirst: mocks.job, findMany: mocks.jobs, upsert: mocks.upsert,
    updateMany: mocks.updateMany, update: mocks.update, groupBy: mocks.group },
  poseWorkerState: { findUnique: mocks.state },
} }));
vi.mock('@/lib/admin-session', () => ({ requireAdminAsync: mocks.admin }));
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
vi.mock('@/lib/s3', async (original) => ({ ...await original<typeof import('@/lib/s3')>(), headObjectSize: mocks.head }));

import { enqueueMissingPoseJobs, enqueuePoseJob } from '@/lib/pose/jobs';
import { GET, POST } from '@/app/api/admin/pose-jobs/route';
import { jobCanResume, referenceSnapshotMatches, poseRetryDelay, referenceAttemptKey } from '@/lib/pose/queue-policy';
vi.stubEnv('POSE_WORKER_TEST', '1');
const { claimPoseJob, commitPoseResult, processPoseJob } = await import('../../workers/pose-worker');
const request = (body: unknown) => new NextRequest('https://trenki.test/api/admin/pose-jobs', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});
const fixture = () => ({ id: 'job', videoId: 'video', sourceUrl: 's3://videos/ready.mp4', status: 'PROCESSING',
  referenceUpdatedAt: null, attempts: 1, interruptions: 0, runToken: 'new-owner', updatedAt: new Date(),
} as PoseReferenceJob);
const doc = { v: 1, model: 'pose_landmarker_heavy' as const, fps: 10, width: 640, height: 360, durationMs: 1000, frames: [[0], [100]] };

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('S3_ENDPOINT', 'https://s3.test'); vi.stubEnv('S3_REGION', 'test'); vi.stubEnv('S3_BUCKET', 'test');
  vi.stubEnv('S3_ACCESS_KEY_ID', 'test'); vi.stubEnv('S3_SECRET_ACCESS_KEY', 'test');
  mocks.admin.mockResolvedValue(null); mocks.transaction.mockImplementation((fn) => fn(tx));
  mocks.video.mockResolvedValue({ videoUrl: fixture().sourceUrl, poseReference: null });
  mocks.job.mockResolvedValue(null); mocks.updateMany.mockResolvedValue({ count: 1 });
});

describe('persistent pose queue', () => {
  it('returns job progress and worker liveness without selecting internal source URLs', async () => {
    mocks.jobs.mockResolvedValue([{ id: 'job', progress: 45, status: 'PROCESSING', video: { title: 'Test' } }]);
    mocks.group.mockResolvedValue([{ status: 'PROCESSING', _count: 1 }]);
    mocks.state.mockResolvedValue({ heartbeatAt: new Date() });
    const result = await GET(new NextRequest('https://trenki.test/api/admin/pose-jobs?videoId=video'));
    expect(await result.json()).toMatchObject({ workerOnline: true, counts: { PROCESSING: 1 }, jobs: [{ progress: 45 }] });
    expect(mocks.jobs.mock.calls[0][0]).toMatchObject({ where: { videoId: 'video' } });
    expect(mocks.jobs.mock.calls[0][0].select).not.toHaveProperty('sourceUrl');
  });
  it('guards read and write before DB/S3 access', async () => {
    mocks.admin.mockResolvedValue(NextResponse.json({}, { status: 401 }));
    expect((await GET(new NextRequest('https://trenki.test/api/admin/pose-jobs'))).status).toBe(401);
    expect((await POST(request({ action: 'missing' }))).status).toBe(401);
    expect(mocks.transaction).not.toHaveBeenCalled(); expect(mocks.jobs).not.toHaveBeenCalled();
  });
  it.each([{}, [], { action: 'delete' }, { action: 'enqueue', videoId: '../video' }, { action: 'enqueue', videoId: 'v', replace: 'true' }])('rejects invalid operation %j', async (body) => {
    expect((await POST(request(body))).status).toBe(400); expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it('requires configured S3 before creating work', async () => {
    vi.stubEnv('S3_BUCKET', '');
    expect((await POST(request({ action: 'missing' }))).status).toBe(503);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it('records source and reference version under a video lock', async () => {
    const updatedAt = new Date(10);
    mocks.video.mockResolvedValue({ videoUrl: fixture().sourceUrl, poseReference: { updatedAt } });
    expect(await enqueuePoseJob('video', true)).toBe('queued');
    expect(mocks.raw).toHaveBeenCalled();
    expect(mocks.upsert).toHaveBeenCalledWith(expect.objectContaining({ update: expect.objectContaining({ referenceUpdatedAt: updatedAt, sourceUrl: fixture().sourceUrl, runToken: null }) }));
  });
  it('preserves existing references by default', async () => {
    mocks.video.mockResolvedValue({ videoUrl: fixture().sourceUrl, poseReference: { updatedAt: new Date() } });
    expect(await enqueuePoseJob('video')).toBe('ready'); expect(mocks.upsert).not.toHaveBeenCalled();
  });
  it.each(['QUEUED', 'PROCESSING'])('deduplicates %s jobs including forced requests', async (status) => {
    mocks.job.mockResolvedValue({ status });
    expect(await enqueuePoseJob('video', true)).toBe('existing'); expect(mocks.upsert).not.toHaveBeenCalled();
  });
  it.each(['s3://uploads/raw.mp4', 'https://kinescope.io/abc', '/video/local.mp4'])('does not enqueue unsupported source %s', async (videoUrl) => {
    mocks.video.mockResolvedValue({ videoUrl, poseReference: null });
    await expect(enqueuePoseJob('video')).rejects.toThrow('готовый'); expect(mocks.upsert).not.toHaveBeenCalled();
  });
  it('bulk traverses the complete catalog and filters encoded raw URLs', async () => {
    mocks.videos.mockResolvedValue([{ id: 'v', videoUrl: fixture().sourceUrl }, { id: 'raw', videoUrl: 'https://s3.test/test/%75ploads/raw.mp4' }]);
    expect(await enqueueMissingPoseJobs()).toEqual({ queued: 1, existing: 0, ready: 0, rejected: 1 });
    expect(mocks.videos.mock.calls[0][0]).not.toHaveProperty('take');
  });
  it('cancel invalidates the lease without deleting video or reference objects', async () => {
    expect((await POST(request({ action: 'cancel', videoId: 'video' }))).status).toBe(200);
    expect(mocks.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'CANCELED', runToken: null }) }));
  });
});

describe('worker ownership and publication', () => {
  it('cannot publish with a stolen lease', async () => {
    expect(await commitPoseResult(fixture(), 's3://pose/new.json.gz', doc)).toBe(false);
    expect(mocks.reference).not.toHaveBeenCalled();
  });
  it.each([
    { videoUrl: 's3://videos/replaced.mp4', poseReference: null },
    { videoUrl: fixture().sourceUrl, poseReference: { updatedAt: new Date(10) } },
    null,
  ])('rejects source changes, edited references and deleted videos', async (video) => {
    mocks.job.mockResolvedValue(fixture()); mocks.video.mockResolvedValue(video);
    expect(await commitPoseResult(fixture(), 's3://pose/new.json.gz', doc)).toBe(false);
    expect(mocks.reference).not.toHaveBeenCalled(); expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'CANCELED' }) }));
  });
  it('publishes metadata and DONE atomically only for the owner', async () => {
    mocks.job.mockResolvedValue(fixture());
    expect(await commitPoseResult(fixture(), 's3://pose/new.json.gz', doc)).toBe(true);
    expect(mocks.reference).toHaveBeenCalledWith(expect.objectContaining({ update: expect.objectContaining({ framesUrl: 's3://pose/new.json.gz', frameCount: 2 }) }));
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'DONE', progress: 100, runToken: null }) }));
  });
  it('stale takeover increments interruptions and changes the fencing token', async () => {
    const candidate = fixture();
    mocks.job.mockResolvedValueOnce(candidate).mockResolvedValueOnce(candidate);
    await claimPoseJob();
    expect(mocks.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ updatedAt: candidate.updatedAt }),
      data: expect.objectContaining({ interruptions: { increment: 1 }, runToken: expect.any(String) }),
    }));
    expect(mocks.updateMany.mock.calls[0][0].data).not.toHaveProperty('attempts');
    expect(mocks.updateMany.mock.calls[0][0].data.runToken).not.toBe(candidate.runToken);
  });
  it('a lost claim never grants ownership', async () => {
    mocks.job.mockResolvedValueOnce(fixture()).mockResolvedValueOnce(null);
    mocks.updateMany.mockResolvedValueOnce({ count: 0 });
    expect(await claimPoseJob()).toBeNull();
  });
  it('missing source fails visibly without creating a reference', async () => {
    mocks.head.mockResolvedValue(null);
    await processPoseJob(fixture());
    expect(mocks.reference).not.toHaveBeenCalled();
    expect(mocks.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ runToken: 'new-owner' }), data: expect.objectContaining({ status: 'FAILED' }),
    }));
  });
  it('an interrupted worker gets a separate retry budget from real errors', () => {
    expect(jobCanResume({ status: 'PROCESSING', attempts: 3, interruptions: 2 })).toBe(true);
    expect(jobCanResume({ status: 'QUEUED', attempts: 3, interruptions: 0 })).toBe(false);
    expect(jobCanResume({ status: 'PROCESSING', attempts: 1, interruptions: 20 })).toBe(false);
    expect(poseRetryDelay(1)).toBe(60_000); expect(poseRetryDelay(2)).toBe(300_000);
  });
  it('uses immutable attempt objects and exact reference versions', () => {
    expect(referenceAttemptKey('video', 'token-1')).not.toBe(referenceAttemptKey('video', 'token-2'));
    expect(() => referenceAttemptKey('../video', 'token')).toThrow();
    expect(referenceSnapshotMatches(null, null)).toBe(true);
    expect(referenceSnapshotMatches(new Date(1), new Date(2))).toBe(false);
  });
});
