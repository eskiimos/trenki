import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  cycle: vi.fn(),
  days: vi.fn(),
  sessions: vi.fn(),
  firstSession: vi.fn(),
  sessionById: vi.fn(),
  updateSessions: vi.fn(),
  profile: vi.fn(),
  assignments: vi.fn(),
}));
vi.mock('@/lib/coach/guards', () => ({ requireAuthUser: mocks.auth }));
vi.mock('@/lib/prisma', () => {
  const prisma = {
    microcycle: { findFirst: mocks.cycle },
    microcycleDay: { findMany: mocks.days },
    workoutSession: { findMany: mocks.sessions, findFirst: mocks.firstSession, findUnique: mocks.sessionById, updateMany: mocks.updateSessions },
    profile: { findUnique: mocks.profile },
    trainingAssignment: { findMany: mocks.assignments },
  };
  return { prisma, default: prisma };
});
vi.mock('@/lib/s3', () => ({ resolveVideoUrl: vi.fn() }));

import { GET as getCycle } from '@/app/api/microcycle/current/route';
import { GET as getTraining } from '@/app/api/training/current/route';
import { ELIGIBLE_MICROCYCLE_WHERE } from '@/lib/microcycle/eligibility';

const request = (path: string) => new NextRequest(`https://trenki.example.test${path}`);
const workout = () => ({
  id: 'selected', userId: 'athlete', status: 'PENDING', totalVideos: 0,
  currentVideoIndex: 0, videos: [], microcycleDay: null,
  startedAt: null, createdAt: new Date(),
});

beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue({ user: { id: 'athlete', timezone: 'UTC' } });
  mocks.cycle.mockResolvedValue(null);
  mocks.days.mockResolvedValue([]);
  mocks.sessions.mockResolvedValue([]);
  mocks.firstSession.mockResolvedValue(null);
  mocks.sessionById.mockResolvedValue(null);
  mocks.profile.mockResolvedValue(null);
  mocks.assignments.mockResolvedValue([]);
});

describe('cycle opt-in in existing read endpoints', () => {
  it('requires a session before reading cycle or training data', async () => {
    mocks.auth.mockResolvedValue({ response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) });
    expect((await getCycle(request('/api/microcycle/current'))).status).toBe(401);
    expect((await getTraining(request('/api/training/current?scope=today'))).status).toBe(401);
    expect(mocks.cycle).not.toHaveBeenCalled();
    expect(mocks.sessions).not.toHaveBeenCalled();
  });

  it('filters current cycles by explicit request or real participation while retaining ownership and archive guards', async () => {
    const response = await getCycle(request('/api/microcycle/current'));
    expect(await response.json()).toEqual({ microcycle: null });
    expect(mocks.cycle.mock.calls[0][0].where).toMatchObject({
      userId: 'athlete', status: { not: 'ARCHIVED' }, feedback: null,
      AND: ELIGIBLE_MICROCYCLE_WHERE,
    });
    expect(mocks.updateSessions).not.toHaveBeenCalled();
  });

  it('does not suggest untouched legacy cycle days in today reminder and never writes from this scope', async () => {
    expect(await (await getTraining(request('/api/training/current?scope=today'))).json()).toEqual({ workout: null });
    expect(mocks.days.mock.calls[0][0].where.microcycle).toMatchObject({
      userId: 'athlete', AND: ELIGIBLE_MICROCYCLE_WHERE,
    });
    expect(mocks.updateSessions).not.toHaveBeenCalled();
  });

  it('unqualified current training keeps quick workouts and eligible plans, excluding untouched legacy days', async () => {
    expect(await (await getTraining(request('/api/training/current'))).json()).toEqual({ workout: null });
    expect(mocks.firstSession.mock.calls[1][0].where).toMatchObject({
      userId: 'athlete', status: 'PENDING',
      OR: [
        { microcycleDay: { is: null } },
        { microcycleDay: { is: { microcycle: { is: ELIGIBLE_MICROCYCLE_WHERE } } } },
      ],
    });
    expect(mocks.updateSessions).not.toHaveBeenCalled();
  });

  it('explicit workout link remains readable without changing or deleting legacy plans', async () => {
    mocks.sessionById.mockResolvedValue(workout());
    const data = await (await getTraining(request('/api/training/current?workoutId=selected'))).json();
    expect(data.workout.id).toBe('selected');
    expect(mocks.firstSession).not.toHaveBeenCalled();
    expect(mocks.updateSessions).not.toHaveBeenCalled();
  });

  it('choosing a quick workout still protects legacy cycle sessions from skipped-session cleanup', async () => {
    mocks.firstSession.mockResolvedValueOnce(null).mockResolvedValueOnce(workout());
    mocks.days.mockResolvedValue([{ workoutSessionId: 'legacy-pending' }]);
    expect((await getTraining(request('/api/training/current'))).status).toBe(200);
    expect(mocks.updateSessions.mock.calls[0][0].where.id.notIn).toContain('legacy-pending');
    expect(mocks.days.mock.calls[0][0].where.microcycle).not.toHaveProperty('AND');
  });
});
