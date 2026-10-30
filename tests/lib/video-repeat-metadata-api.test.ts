import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { assessmentPreset } from '@/lib/pose/assessment-settings';

const mocks = vi.hoisted(() => ({ find: vi.fn(), gate: vi.fn(), freeLesson: vi.fn(), resolveUrl: vi.fn() }));
vi.mock('@/lib/prisma', () => ({ prisma: { video: { findUnique: mocks.find } } }));
vi.mock('@/lib/admin-session', () => ({ requireAdminAsync: vi.fn() }));
vi.mock('@/lib/coach/guards', () => ({ gatePaidContent: mocks.gate }));
vi.mock('@/lib/settings', () => ({ getFreeLessonVideoId: mocks.freeLesson }));
vi.mock('@/lib/s3', () => ({
  resolveVideoUrl: mocks.resolveUrl,
  deleteS3ObjectsByUrls: vi.fn(), isOwnStorageUrl: vi.fn(), isS3Url: vi.fn(),
}));
vi.mock('@/lib/media/url-plan', () => ({ isRawUploadUrl: vi.fn(), planUrlUpdate: vi.fn() }));
vi.mock('@/lib/media/jobs', () => ({ cancelMediaJobsForTarget: vi.fn(), enqueueMediaJob: vi.fn(), hasJobForSource: vi.fn(), setPublishIntent: vi.fn() }));
vi.mock('@/lib/media/worker', () => ({ kickMediaWorker: vi.fn() }));

import { GET } from '@/app/api/videos/[id]/route';

const repeat = { enabled: true, seekToMs: 0, promptDelayMs: 7000, promptDurationMs: 5000 };
const segment = { startMs: 5000, endMs: 15000, repeat };
const video = () => ({
  id: 'video', title: 'Exercise', videoUrl: 's3://video.mp4', coauthors: [],
  poseReference: {
    segments: [{ ...segment, assessment: assessmentPreset('legs') }], durationSec: 60,
    framesUrl: 's3://private-reference', createdById: 'private-admin', frames: ['private-points'],
  },
});
const request = () => new NextRequest('https://trenki.test/api/videos/video');
const context = { params: Promise.resolve({ id: 'video' }) };

beforeEach(() => {
  vi.resetAllMocks();
  mocks.gate.mockResolvedValue(null);
  mocks.freeLesson.mockResolvedValue(null);
  mocks.find.mockResolvedValue(video());
  mocks.resolveUrl.mockResolvedValue('https://media.test/video.mp4');
});

describe('video repeat metadata shares the video content access', () => {
  it.each([401, 402])('does not read or return metadata when the existing content gate returns %i', async (status) => {
    mocks.gate.mockResolvedValue(NextResponse.json({ error: 'blocked' }, { status }));
    const response = await GET(request(), context);
    expect(response.status).toBe(status);
    expect(mocks.find).not.toHaveBeenCalled();
    expect(mocks.resolveUrl).not.toHaveBeenCalled();
  });

  it('selects only reference timings and removes the internal reference from the response', async () => {
    const response = await GET(request(), context);
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.repeatSegments).toEqual([segment]);
    expect(result.videoUrl).toBe('https://media.test/video.mp4');
    expect(result).not.toHaveProperty('poseReference');
    expect(JSON.stringify(result)).not.toContain('private-');
    expect(result.repeatSegments[0]).not.toHaveProperty('assessment');
    const select = mocks.find.mock.calls[0][0].select;
    expect(select.poseReference).toEqual({ select: { segments: true, durationSec: true } });
    expect(JSON.stringify(select)).not.toMatch(/frames|createdById/);
    expect(mocks.gate.mock.invocationCallOrder[0]).toBeLessThan(mocks.find.mock.invocationCallOrder[0]);
  });

  it('preserves the current free-lesson exemption and its same lightweight metadata', async () => {
    mocks.freeLesson.mockResolvedValue('video');
    const response = await GET(request(), context);
    expect(response.status).toBe(200);
    expect(mocks.gate).not.toHaveBeenCalled();
    expect((await response.json()).repeatSegments).toEqual([segment]);
  });

  it.each([null, { durationSec: 60, segments: [{ ...segment, repeat: { ...repeat, seekToMs: 20000 } }] }])('keeps video playback available without valid repeat metadata', async (poseReference) => {
    mocks.find.mockResolvedValue({ ...video(), poseReference });
    const response = await GET(request(), context);
    expect(response.status).toBe(200);
    expect((await response.json()).repeatSegments).toEqual([]);
  });

  it('does not resolve a source or return repeat metadata for a nonexistent video', async () => {
    mocks.find.mockResolvedValue(null);
    expect((await GET(request(), context)).status).toBe(404);
    expect(mocks.resolveUrl).not.toHaveBeenCalled();
  });
});
