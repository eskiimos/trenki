import { expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/gamification/achievements/route';
import { PUT } from '@/app/api/gamification/pinned/route';
import { cycleCreditQuery } from '@/lib/achievements';

const db = vi.hoisted(() => ({ cycles: vi.fn(), update: vi.fn() }));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    workoutSession: { groupBy: async () => [{ goal: 'POWERFUL_SHOT', _count: { _all: 4 } }] },
    microcycle: { findMany: db.cycles },
    user: { update: db.update },
  },
}));
vi.mock('@/lib/coach/guards', () => ({
  requireAuthUser: async () => ({ user: { id: 'athlete', teamPackEarnedAt: null } }),
}));
vi.mock('@/lib/gamification-server', () => ({
  fetchCompletionHistory: async () => ({ trainingDayAts: [] }),
  userTimezone: async () => 'UTC',
}));

it('lists and allows pinning a skill unlocked by the same completed tagged cycle day', async () => {
  db.cycles.mockResolvedValue([{
    cycleNumber: 23, macrocycleWeek: 2,
    days: [{ dayOfWeek: 1, intent: 'IN_TONE', workoutSession: {
      status: 'COMPLETED', goal: null,
      videos: [{ completed: true, video: { moduleType: 'TECHNIQUE', trainingGoals: ['POWERFUL_SHOT'] } }],
    } }],
  }]);
  const result = await GET(new NextRequest('http://localhost/api/gamification/achievements'));
  expect((await result.json()).achievements).toContainEqual(expect.objectContaining({ key: 'shot_evo1', unlocked: true }));
  const pinned = await PUT(new NextRequest('http://localhost/api/gamification/pinned', {
    method: 'PUT', body: JSON.stringify({ keys: ['shot_evo1'] }),
  }));
  expect(pinned.status).toBe(200);
  expect(db.update).toHaveBeenCalledWith({ where: { id: 'athlete' }, data: { pinnedAchievements: ['shot_evo1'] } });
  expect(db.cycles.mock.calls).toEqual([[cycleCreditQuery('athlete')], [cycleCreditQuery('athlete')]]);
});
