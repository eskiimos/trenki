import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  user: vi.fn(),
  findPrevious: vi.fn(),
  findForWeek: vi.fn(),
  buildDay: vi.fn(),
  transaction: vi.fn(),
  lockPreference: vi.fn(),
  createCycle: vi.fn(),
  createDay: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: db.user },
    microcycle: { findFirst: db.findPrevious, findUnique: db.findForWeek },
    $transaction: db.transaction,
  },
}));
vi.mock('@/lib/microcycle/build-day', () => ({ buildMicrocycleDayWorkout: db.buildDay }));

import { generateMicrocycleForUser } from '@/lib/microcycle/generate';

const now = new Date('2026-11-16T12:00:00Z');
const profile = { potential: 45, autoGenerateMicrocycle: false };

beforeEach(() => {
  vi.resetAllMocks();
  db.user.mockResolvedValue({ profile });
  db.findPrevious.mockResolvedValue(null);
  db.findForWeek.mockResolvedValue(null);
  db.buildDay.mockResolvedValue({ modules: [], totalDuration: 0, missingModules: [], rpeAvg: 5 });
  db.transaction.mockImplementation(fn => fn({
    $queryRaw: db.lockPreference,
    microcycle: { create: db.createCycle },
    microcycleDay: { create: db.createDay },
  }));
  db.createCycle.mockResolvedValue({ id: 'cycle' });
});

describe('weekly plan autogeneration preference', () => {
  it('skips automatic generation while the preference is off', async () => {
    const result = await generateMicrocycleForUser('athlete', { now, onlyIfAutoGenerateEnabled: true });
    expect(result.status).toBe('AUTO_GENERATE_DISABLED');
    expect(db.buildDay).not.toHaveBeenCalled();
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it('allows a manual plan while the preference is off', async () => {
    const result = await generateMicrocycleForUser('athlete', { now });
    expect(result.status).toBe('CREATED');
    expect(db.lockPreference).not.toHaveBeenCalled();
    expect(db.createDay).toHaveBeenCalledTimes(5);
  });

  it.each([false, true])('uses the current preference at save time (%s)', async enabled => {
    db.user.mockResolvedValue({ profile: { ...profile, autoGenerateMicrocycle: true } });
    db.lockPreference.mockResolvedValue([{ enabled }]);
    const result = await generateMicrocycleForUser('athlete', { now, onlyIfAutoGenerateEnabled: true });
    expect(result.status).toBe(enabled ? 'CREATED' : 'AUTO_GENERATE_DISABLED');
    expect(db.buildDay).toHaveBeenCalledTimes(5);
    expect(db.lockPreference).toHaveBeenCalledOnce();
    expect(db.createCycle).toHaveBeenCalledTimes(enabled ? 1 : 0);
  });
});
