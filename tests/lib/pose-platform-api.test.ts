import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { gzipSync } from 'zlib';

const mocks = vi.hoisted(() => ({
  admin: vi.fn(),
  findMany: vi.fn(),
  findUnique: vi.fn(),
  upsert: vi.fn(),
  referenceFind: vi.fn(),
  referenceUpdate: vi.fn(),
  transaction: vi.fn(),
  queryRaw: vi.fn(),
  openObjectStream: vi.fn(),
  saveReferenceFrames: vi.fn(),
  resolveVideoUrl: vi.fn(),
  sessionUserId: vi.fn(),
}));
vi.mock('@/lib/admin-session', () => ({ requireAdminAsync: mocks.admin }));
vi.mock('@/lib/prisma', () => ({
  prisma: { $transaction: mocks.transaction, video: { findMany: mocks.findMany, findUnique: mocks.findUnique }, poseReference: { upsert: mocks.upsert, findUnique: mocks.referenceFind, update: mocks.referenceUpdate } },
}));
vi.mock('@/lib/auth-server', () => ({ getSessionUserId: mocks.sessionUserId }));
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), error: vi.fn() } }));
vi.mock('@/lib/s3', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/lib/s3')>(),
  openObjectStream: mocks.openObjectStream,
  resolveVideoUrl: mocks.resolveVideoUrl,
}));
vi.mock('@/lib/pose/reference-storage', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/lib/pose/reference-storage')>(),
  saveReferenceFrames: mocks.saveReferenceFrames,
}));

import { GET as listVideos } from '@/app/api/admin/pose-references/route';
import { GET as getVideo, PUT as saveReference } from '@/app/api/admin/pose-references/[videoId]/route';
import { GET as getSource } from '@/app/api/admin/pose-references/[videoId]/source/route';
import { PUT as saveSegments } from '@/app/api/admin/pose-references/[videoId]/segments/route';

const request = (query = '') => new NextRequest(`https://trenki.example.test/api/admin/pose-references${query}`);
const ctx = { params: Promise.resolve({ videoId: 'platform-video' }) };
const video = (id = 'platform-video', videoUrl = 's3://videos/ready.mp4') => ({
  id, videoUrl, title: 'Тренировка', duration: 60, thumbnail: null, isPublished: false, trainer: null, poseReference: null,
});

beforeEach(() => {
  vi.resetAllMocks();
  mocks.admin.mockResolvedValue(null);
  mocks.transaction.mockImplementation((fn) => fn({ $queryRaw: mocks.queryRaw, poseReference: { upsert: mocks.upsert, findUnique: mocks.referenceFind, update: mocks.referenceUpdate } }));
  mocks.resolveVideoUrl.mockResolvedValue('https://storage.example.test/playback.mp4');
  mocks.sessionUserId.mockResolvedValue('admin-user');
  vi.stubEnv('S3_ENDPOINT', 'https://storage.example.test');
  vi.stubEnv('S3_REGION', 'test');
  vi.stubEnv('S3_BUCKET', 'trenki');
  vi.stubEnv('S3_ACCESS_KEY_ID', 'test');
  vi.stubEnv('S3_SECRET_ACCESS_KEY', 'test');
});
afterEach(() => vi.unstubAllEnvs());

describe('выбор видео платформы для pose', () => {
  it('отказывает без административной сессии до чтения БД и файлов', async () => {
    mocks.admin.mockResolvedValue(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }));
    expect((await listVideos(request('?scope=library'))).status).toBe(401);
    expect((await getSource(request(), ctx)).status).toBe(401);
    expect((await saveSegments(request(), ctx)).status).toBe(401);
    expect(mocks.findMany).not.toHaveBeenCalled();
    expect(mocks.findUnique).not.toHaveBeenCalled();
    expect(mocks.openObjectStream).not.toHaveBeenCalled();
  });

  it('не принимает неизвестный раздел', async () => {
    expect((await listVideos(request('?scope=unknown'))).status).toBe(400);
    expect(mocks.findMany).not.toHaveBeenCalled();
  });

  it('возвращает неопубликованное готовое видео без внутреннего URL хранилища', async () => {
    mocks.findMany.mockResolvedValue([video()]);
    const data = await (await listVideos(request('?scope=library'))).json();
    expect(data.videos).toHaveLength(1);
    expect(data.videos[0]).toMatchObject({ id: 'platform-video', isPublished: false });
    expect(data.videos[0]).not.toHaveProperty('videoUrl');
    expect(data.nextCursor).toBeNull();
  });

  it('фильтрует raw HTTPS с кодированием, локальные файлы и чужие источники в S3-каталоге', async () => {
    mocks.findMany.mockResolvedValue([
      video('ready', 'https://storage.example.test/trenki/videos/ready.mp4'),
      video('raw', 'https://storage.example.test/trenki/%75ploads%2Fraw.mp4'),
      video('local', '/video/local.mp4'),
      video('foreign', 'https://kinescope.io/video'),
    ]);
    const data = await (await listVideos(request('?scope=library'))).json();
    expect(data.videos.map((v: { id: string }) => v.id)).toEqual(['ready']);
  });

  it('пагинация продолжает выдачу после первых 50, без ограничения каталога 300 видео', async () => {
    mocks.findMany.mockResolvedValue(Array.from({ length: 51 }, (_, i) => video(`v-${i}`)));
    const first = await (await listVideos(request('?scope=library'))).json();
    expect(first.videos).toHaveLength(50);
    expect(first.nextCursor).toBe('v-49');
    mocks.findMany.mockResolvedValue([video('v-50')]);
    const next = await (await listVideos(request('?scope=library&cursor=v-49'))).json();
    expect(next.videos[0].id).toBe('v-50');
    expect(next.nextCursor).toBeNull();
    expect(mocks.findMany).toHaveBeenLastCalledWith(expect.objectContaining({ cursor: { id: 'v-49' }, skip: 1 }));
  });

  it('поиск по названию и полному имени тренера применяется до пагинации', async () => {
    mocks.findMany.mockResolvedValue([]);
    await listVideos(request('?scope=library&q=Иван%20Иванов'));
    const where = mocks.findMany.mock.calls[0]![0].where;
    expect(where.AND).toEqual(expect.arrayContaining([
      expect.objectContaining({ OR: expect.arrayContaining([
        { title: { contains: 'Иван', mode: 'insensitive' } },
        { trainer: { is: { name: { contains: 'Иван', mode: 'insensitive' } } } },
      ]) }),
      expect.objectContaining({ OR: expect.arrayContaining([
        { trainer: { is: { lastName: { contains: 'Иванов', mode: 'insensitive' } } } },
      ]) }),
    ]));
  });

  it('раздел эталонов выбирает только видео с сохранённым эталоном', async () => {
    mocks.findMany.mockResolvedValue([]);
    await listVideos(request('?scope=references'));
    expect(mocks.findMany.mock.calls[0]![0].where.AND).toContainEqual({ poseReference: { isNot: null } });
  });

  it('ручная разметка блокирует ту же карточку и учитывает актуальную длительность эталона', async () => {
    mocks.referenceFind.mockResolvedValueOnce({ durationSec: 4 }).mockResolvedValueOnce({ durationSec: 2 });
    const upload = new NextRequest('https://trenki.example.test/api/admin/pose-references/platform-video/segments', {
      method: 'PUT', body: JSON.stringify({ segments: [{ startMs: 500, endMs: 3500 }] }),
    });
    const result = await saveSegments(upload, ctx);
    expect(result.status).toBe(200);
    expect(await result.json()).toEqual({ segments: [{ startMs: 500, endMs: 2000 }] });
    expect(mocks.queryRaw).toHaveBeenCalled();
    expect(mocks.referenceUpdate).toHaveBeenCalledWith({ where: { videoId: 'platform-video' }, data: { segments: [{ startMs: 500, endMs: 2000 }] } });
  });

  it('выбранное HTTPS-видео скачивается через admin API и эталон сохраняется к тому же Video', async () => {
    mocks.findUnique.mockResolvedValue(video('platform-video', 'https://storage.example.test/trenki/videos/ready.mp4'));
    const detail = await (await getVideo(request(), ctx)).json();
    expect(detail.sourceUrl).toBe('/api/admin/pose-references/platform-video/source');
    expect(detail.playbackUrl).toBe('https://storage.example.test/playback.mp4');
    expect(mocks.resolveVideoUrl).toHaveBeenCalledWith('s3://videos/ready.mp4');
    const bytes = new Uint8Array([1, 2, 3]);
    mocks.openObjectStream.mockResolvedValue({ body: new ReadableStream({ start(c) { c.enqueue(bytes); c.close(); } }), contentType: 'video/mp4', contentLength: 3 });
    const source = await getSource(request(), ctx);
    expect([...new Uint8Array(await source.arrayBuffer())]).toEqual([...bytes]);
    expect(mocks.openObjectStream).toHaveBeenCalledWith('videos/ready.mp4', expect.any(AbortSignal));

    const doc = { v: 1, model: 'pose_landmarker_heavy', fps: 10, durationMs: 1000, width: 640, height: 360, frames: [[0], [100]] };
    mocks.saveReferenceFrames.mockResolvedValue('s3://pose/references/platform-video.json.gz');
    mocks.upsert.mockResolvedValue({ frameCount: 2 });
    const upload = new NextRequest('https://trenki.example.test/api/admin/pose-references/platform-video', {
      method: 'PUT', headers: { 'Content-Type': 'application/gzip' }, body: new Uint8Array(gzipSync(JSON.stringify(doc))),
    });
    expect((await saveReference(upload, ctx)).status).toBe(200);
    expect(mocks.saveReferenceFrames).toHaveBeenCalledWith('platform-video', expect.any(Buffer));
    expect(mocks.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { videoId: 'platform-video' },
      create: expect.objectContaining({ videoId: 'platform-video', framesUrl: 's3://pose/references/platform-video.json.gz', frameCount: 2, createdById: 'admin-user' }),
    }));
  });
});
