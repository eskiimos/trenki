import { beforeEach, describe, expect, it, vi } from 'vitest';
import { generateMicrocycleForUser } from '@/lib/microcycle/generate';

const db = vi.hoisted(() => ({
  transaction: vi.fn(), profileLock: vi.fn(), previous: vi.fn(), catalog: vi.fn(),
  createCycle: vi.fn(), createDay: vi.fn(), createSession: vi.fn(), deleteCycle: vi.fn(), deleteSessions: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({ prisma: { $transaction: db.transaction } }));
vi.mock('@/lib/microcycle/macrocycle-selection', async importOriginal => ({
  ...await importOriginal<typeof import('@/lib/microcycle/macrocycle-selection')>(),
  loadMacrocycleCatalog: db.catalog,
}));

const now = new Date('2026-11-16T12:00:00Z');
const profile = { potential: 45, autoGenerateMicrocycle: false, ageGroup: 'TEEN', birthDate: null };
const week = {
  id: 'previous', cycleNumber: 12, weekStartDate: new Date('2026-10-12Z'), macrocycleWeek: 2,
  status: 'ACTIVE', feedback: null, days: [],
};

beforeEach(() => {
  vi.resetAllMocks();
  db.profileLock.mockResolvedValue([profile]);
  db.previous.mockResolvedValue(null);
  db.transaction.mockImplementation(fn => fn({
    $queryRaw: db.profileLock,
    microcycle: { findFirst: db.previous, create: db.createCycle, delete: db.deleteCycle },
    workoutSession: { create: db.createSession, deleteMany: db.deleteSessions },
    microcycleDay: { create: db.createDay },
  }));
  db.catalog.mockResolvedValue([{
    id: 'warmup', duration: 120, moduleType: 'WARMUP', muscleGroup: 'FULL_BODY',
    loadTypes: ['DYNAMIC_STRETCH'], complexity: 'AMATEUR',
  }]);
  db.createCycle.mockResolvedValue({ id: 'cycle' });
  db.createSession.mockResolvedValue({ id: 'session' });
});

describe('macrocycle generation', () => {
  it.each([false, true])('respects the locked autogeneration preference (%s)', async enabled => {
    db.profileLock.mockResolvedValue([{ ...profile, autoGenerateMicrocycle: enabled }]);
    const result = await generateMicrocycleForUser('athlete', { now, onlyIfAutoGenerateEnabled: true });
    expect(result.status).toBe(enabled ? 'CREATED' : 'AUTO_GENERATE_DISABLED');
    expect(db.profileLock).toHaveBeenCalledOnce();
    expect(db.createCycle).toHaveBeenCalledTimes(enabled ? 1 : 0);
  });

  it('allows a manual week with the preference off, reporting unfilled slots', async () => {
    const result = await generateMicrocycleForUser('athlete', { now });
    expect(result).toMatchObject({ status: 'CREATED', macrocycleWeek: 1 });
    expect(result.days?.[0]).toMatchObject({ moduleCount: 1, missingModules: ['FITNESS', 'TECHNIQUE'] });
    expect(db.createDay).toHaveBeenCalledTimes(5);
  });

  it.each([[null, 1], [1, 2], [2, 3], [3, 4], [4, 1]])('continues after a break from %s to %s', async (previous, next) => {
    db.previous.mockResolvedValue({ ...week, macrocycleWeek: previous, feedback: 'HARD', status: 'ARCHIVED' });
    const result = await generateMicrocycleForUser('athlete', { now });
    expect(result).toMatchObject({ cycleNumber: 13, macrocycleWeek: next });
    expect(result.days?.map(day => day.intent)).toEqual(['IN_TONE', 'WARMUP', 'CHARGED', 'STRETCH', 'TIRED']);
    expect(db.deleteCycle).not.toHaveBeenCalled();
  });

  it('preserves an expired week even if its survey is unanswered', async () => {
    db.previous.mockResolvedValue(week);
    const result = await generateMicrocycleForUser('athlete', { now });
    expect(result).toMatchObject({ status: 'CREATED', macrocycleWeek: 3 });
    expect(db.deleteCycle).not.toHaveBeenCalled();
  });

  it('reuses an active week unless its ID is explicitly submitted for rebuild', async () => {
    db.previous.mockResolvedValue({ ...week, weekStartDate: new Date('2026-11-16Z') });
    const startDate = new Date('2026-11-18Z');
    expect((await generateMicrocycleForUser('athlete', { startDate })).status).toBe('EXISTING');
    expect((await generateMicrocycleForUser('athlete', { startDate, rebuildId: 'stale' })).status).toBe('STALE_REBUILD');
    expect(db.deleteCycle).not.toHaveBeenCalled();
    const rebuilt = await generateMicrocycleForUser('athlete', { startDate, rebuildId: 'previous' });
    expect(rebuilt).toMatchObject({ cycleNumber: 12, macrocycleWeek: 2, weekStartDate: startDate, rebuilt: true });
    expect(rebuilt.days).toHaveLength(4);
  });

  it('schedules the next focus on Monday when the week already finished on Friday', async () => {
    db.previous.mockResolvedValue({ ...week, weekStartDate: new Date('2026-11-16Z') });
    const result = await generateMicrocycleForUser('athlete', { startDate: new Date('2026-11-21Z') });
    expect(result).toMatchObject({ macrocycleWeek: 3, weekStartDate: new Date('2026-11-23Z') });
  });

  it('preserves the active plan when there is no eligible catalog or age', async () => {
    db.previous.mockResolvedValue({ ...week, weekStartDate: new Date('2026-11-16Z') });
    db.catalog.mockResolvedValue([]);
    expect((await generateMicrocycleForUser('athlete', { now, rebuildId: week.id })).status).toBe('NO_MATCHING_VIDEOS');
    db.profileLock.mockResolvedValue([{ ...profile, ageGroup: null }]);
    expect((await generateMicrocycleForUser('athlete', { now, rebuildId: week.id })).status).toBe('AGE_REQUIRED');
    expect(db.deleteCycle).not.toHaveBeenCalled();
    expect(db.createCycle).not.toHaveBeenCalled();
  });
});
