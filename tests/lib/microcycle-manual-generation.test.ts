import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  userFind: vi.fn(), cycleFindFirst: vi.fn(), cycleFindUnique: vi.fn(),
  cycleCreate: vi.fn(), sessionCreate: vi.fn(), dayCreate: vi.fn(), transaction: vi.fn(), buildDay: vi.fn(),
}));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: mocks.userFind },
    microcycle: { findFirst: mocks.cycleFindFirst, findUnique: mocks.cycleFindUnique },
    $transaction: mocks.transaction,
  },
}));
vi.mock('@/lib/microcycle/build-day', () => ({ buildMicrocycleDayWorkout: mocks.buildDay }));

import { generateMicrocycleForUser } from '@/lib/microcycle/generate';

beforeEach(() => {
  vi.resetAllMocks();
  mocks.userFind.mockResolvedValue({ profile: { potential: 5, ageGroup: 'YOUNG_ADULT', autoGenerateMicrocycle: false } });
  mocks.cycleFindFirst.mockResolvedValue(null);
  mocks.cycleFindUnique.mockResolvedValue(null);
  mocks.cycleCreate.mockResolvedValue({ id: 'requested-cycle' });
  mocks.sessionCreate.mockResolvedValue({ id: 'requested-session' });
  mocks.buildDay.mockResolvedValue({ modules: [{ id: 'video' }], missingModules: [], totalDuration: 600, rpeAvg: 5 });
  mocks.transaction.mockImplementation((fn) => fn({
    microcycle: { create: mocks.cycleCreate },
    workoutSession: { create: mocks.sessionCreate },
    microcycleDay: { create: mocks.dayCreate },
  }));
});

describe('explicit generation metadata', () => {
  it('marks a manually requested plan independently of the retired auto-generation flag', async () => {
    const now = new Date('2026-10-29T10:00:00Z');
    const startDate = new Date('2026-10-29T00:00:00Z');
    const result = await generateMicrocycleForUser('athlete', { now, startDate });
    expect(result.status).toBe('CREATED');
    expect(mocks.cycleCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: 'athlete', requestedAt: now, weekStartDate: startDate }),
    });
    expect(mocks.sessionCreate).toHaveBeenCalled();
  });

  it('does not turn an untouched legacy plan into an explicit request merely by reading an existing result', async () => {
    mocks.cycleFindUnique.mockResolvedValue({
      id: 'legacy-cycle', weekStartDate: new Date('2026-10-29'), cycleNumber: 1, requestedAt: null, days: [],
    });
    const result = await generateMicrocycleForUser('athlete', { startDate: new Date('2026-10-29') });
    expect(result.status).toBe('EXISTING');
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.cycleCreate).not.toHaveBeenCalled();
  });
});
