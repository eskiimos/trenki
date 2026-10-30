import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

const mocks = vi.hoisted(() => ({ admin: vi.fn(), transaction: vi.fn(), lock: vi.fn(), find: vi.fn(), update: vi.fn() }));
vi.mock('@/lib/admin-session', () => ({ requireAdminAsync: mocks.admin }));
vi.mock('@/lib/prisma', () => ({ prisma: { $transaction: mocks.transaction } }));
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), error: vi.fn() } }));
import { PATCH } from '@/app/api/admin/pose-references/[videoId]/coaching/route';

const date = new Date('2026-10-29T10:00:00.000Z');
const version = date.toISOString();
const ctx = { params: Promise.resolve({ videoId: 'video' }) };
const request = (body: unknown) => new NextRequest('https://trenki.test/api/admin/pose-references/video/coaching', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
beforeEach(() => {
  vi.resetAllMocks();
  mocks.admin.mockResolvedValue(null);
  mocks.transaction.mockImplementation((fn) => fn({ $queryRaw: mocks.lock, video: { findUnique: mocks.find, update: mocks.update } }));
  mocks.find.mockResolvedValue({ updatedAt: date });
  mocks.update.mockImplementation((arg) => ({ poseTrackingEnabled: arg.data.poseTrackingEnabled, updatedAt: new Date(date.getTime() + 1) }));
});

describe('admin video-level biomechanics override API', () => {
  it('requires admin access before validation or reading data', async () => {
    mocks.admin.mockResolvedValue(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }));
    expect((await PATCH(request({ trackingEnabled: false, expectedUpdatedAt: version }), ctx)).status).toBe(401);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it.each([true, false, null])('persists raw override %j under the video lock and returns the next version', async (trackingEnabled) => {
    const response = await PATCH(request({ trackingEnabled, expectedUpdatedAt: version }), ctx);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ trackingEnabled, updatedAt: '2026-10-29T10:00:00.001Z' });
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'video' }, data: { poseTrackingEnabled: trackingEnabled } }));
    expect(mocks.lock.mock.invocationCallOrder[0]).toBeLessThan(mocks.find.mock.invocationCallOrder[0]);
  });
  it.each([null, [], {}, { trackingEnabled: false }, { trackingEnabled: 'false', expectedUpdatedAt: version }, { trackingEnabled: false, expectedUpdatedAt: 'wrong' }])('rejects malformed update %j without writing', async (body) => {
    expect((await PATCH(request(body), ctx)).status).toBe(400);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it('returns 409 instead of overwriting another admin video edit', async () => {
    expect((await PATCH(request({ trackingEnabled: false, expectedUpdatedAt: '2026-10-28T10:00:00.000Z' }), ctx)).status).toBe(409);
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it('returns 404 for a missing video, whether or not it has a pose reference', async () => {
    mocks.find.mockResolvedValue(null);
    expect((await PATCH(request({ trackingEnabled: false, expectedUpdatedAt: version }), ctx)).status).toBe(404);
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it('handles a storage failure without exposing internals', async () => {
    mocks.update.mockRejectedValue(new Error('database private detail'));
    const response = await PATCH(request({ trackingEnabled: false, expectedUpdatedAt: version }), ctx);
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain('private detail');
  });
});
