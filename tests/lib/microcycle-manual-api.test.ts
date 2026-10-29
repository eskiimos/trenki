import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

const mocks = vi.hoisted(() => ({
  auth: vi.fn(), subscription: vi.fn(), generate: vi.fn(),
  profileFind: vi.fn(), profileUpdate: vi.fn(), cycleFind: vi.fn(),
  cycleDelete: vi.fn(), sessionsDelete: vi.fn(), transaction: vi.fn(),
}));
vi.mock('@/lib/coach/guards', () => ({
  requireAuthUser: mocks.auth,
  requireActiveSubscription: mocks.subscription,
}));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    profile: { findUnique: mocks.profileFind, update: mocks.profileUpdate },
    microcycle: { findFirst: mocks.cycleFind, delete: mocks.cycleDelete },
    workoutSession: { deleteMany: mocks.sessionsDelete },
    $transaction: mocks.transaction,
  },
}));
vi.mock('@/lib/microcycle/generate', () => ({ generateMicrocycleForUser: mocks.generate }));

import { GET as runLegacyCron } from '@/app/api/cron/microcycle-autogenerate/route';
import { PATCH as setPreference } from '@/app/api/profile/microcycle-preferences/route';
import { POST as generateManually } from '@/app/api/microcycle/generate/route';

const request = (path: string, body?: unknown) => new NextRequest(`https://trenki.example.test/api/${path}`, {
  method: body === undefined ? 'GET' : 'POST',
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('CRON_SECRET', 'test-cron-secret');
  mocks.auth.mockResolvedValue({ user: { id: 'athlete' } });
  mocks.subscription.mockResolvedValue({ user: { id: 'athlete' } });
  mocks.profileFind.mockResolvedValue({ id: 'profile' });
  mocks.profileUpdate.mockResolvedValue({ autoGenerateMicrocycle: false });
  mocks.cycleFind.mockResolvedValue(null);
  mocks.generate.mockResolvedValue({ status: 'CREATED', microcycleId: 'manual-cycle' });
});
afterEach(() => vi.unstubAllEnvs());

describe('microcycles require an explicit athlete request', () => {
  it('keeps the scheduled endpoint authenticated and never generates or reads profiles', async () => {
    expect((await runLegacyCron(request('cron/microcycle-autogenerate'))).status).toBe(401);
    const authorized = new NextRequest('https://trenki.example.test/api/cron/microcycle-autogenerate', {
      headers: { Authorization: 'Bearer test-cron-secret' },
    });
    const res = await runLegacyCron(authorized);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ disabled: true, reason: 'manual_generation_only', created: 0 });
    expect(mocks.generate).not.toHaveBeenCalled();
    expect(mocks.profileFind).not.toHaveBeenCalled();
    expect(mocks.profileUpdate).not.toHaveBeenCalled();
  });

  it('does not allow an old client to turn automatic generation back on', async () => {
    const res = await setPreference(request('profile/microcycle-preferences', { autoGenerate: true }));
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ code: 'MANUAL_GENERATION_ONLY' });
    expect(mocks.profileUpdate).not.toHaveBeenCalled();
    expect(mocks.generate).not.toHaveBeenCalled();
  });

  it('lets an old client clear its legacy preference without generating a cycle', async () => {
    const res = await setPreference(request('profile/microcycle-preferences', { autoGenerate: false }));
    expect(res.status).toBe(200);
    expect(mocks.profileUpdate).toHaveBeenCalledWith({
      where: { id: 'profile' }, data: { autoGenerateMicrocycle: false }, select: { autoGenerateMicrocycle: true },
    });
    expect(mocks.generate).not.toHaveBeenCalled();
  });

  it('rejects unauthorized preference changes and manual creation before database work', async () => {
    mocks.auth.mockResolvedValue({ response: NextResponse.json({}, { status: 401 }) });
    mocks.subscription.mockResolvedValue({ response: NextResponse.json({}, { status: 402 }) });
    expect((await setPreference(request('profile/microcycle-preferences', { autoGenerate: false }))).status).toBe(401);
    expect((await generateManually(request('microcycle/generate', {}))).status).toBe(402);
    expect(mocks.profileFind).not.toHaveBeenCalled();
    expect(mocks.cycleFind).not.toHaveBeenCalled();
    expect(mocks.generate).not.toHaveBeenCalled();
  });

  it('preserves explicit creation for the authenticated athlete and ignores body userId', async () => {
    const res = await generateManually(request('microcycle/generate', { userId: 'other-athlete' }));
    expect(res.status).toBe(201);
    expect(mocks.generate).toHaveBeenCalledWith('athlete', { startDate: expect.any(Date) });
    expect(await res.json()).toMatchObject({ status: 'CREATED', microcycleId: 'manual-cycle', rebuilt: false });
  });
});
