import { describe, expect, it } from 'vitest';
import { ELIGIBLE_MICROCYCLE_WHERE } from '@/lib/microcycle/eligibility';

/** Evaluate the Prisma filter operators used here without connecting to a DB. */
function matchesWhere(value: unknown, filter: unknown): boolean {
  if (filter === null || typeof filter !== 'object') return value === filter;
  return Object.entries(filter).every(([operator, condition]) => {
    if (operator === 'OR') return (condition as unknown[]).some((part) => matchesWhere(value, part));
    if (operator === 'AND') return (Array.isArray(condition) ? condition : [condition]).every((part) => matchesWhere(value, part));
    if (operator === 'not') return !matchesWhere(value, condition);
    if (operator === 'in') return (condition as unknown[]).includes(value);
    if (operator === 'is') return matchesWhere(value, condition);
    if (operator === 'some') return Array.isArray(value) && value.some((item) => matchesWhere(item, condition));
    if (value === null || typeof value !== 'object') return false;
    return matchesWhere((value as Record<string, unknown>)[operator], condition);
  });
}

const cycle = (status = 'PENDING', startedAt: Date | null = null, completedVideo = false) => ({
  requestedAt: null as Date | null,
  days: [{ workoutSession: { status, startedAt, videos: [{ completed: completedVideo }] } }],
});
const eligible = (value: unknown) => matchesWhere(value, ELIGIBLE_MICROCYCLE_WHERE);

describe('microcycle eligibility query', () => {
  it('does not propose an untouched legacy cycle or one only closed by a quick-training replacement', () => {
    expect(eligible(cycle())).toBe(false);
    // close-day / closeLinkedCycleDay set COMPLETED without starting this
    // session or completing its videos. That does not opt into the cycle.
    expect(eligible(cycle('COMPLETED'))).toBe(false);
    expect(eligible(cycle('PARTIAL'))).toBe(false);
    expect(eligible(cycle('SKIPPED'))).toBe(false);
    expect(eligible({ requestedAt: null, days: [] })).toBe(false);
    expect(eligible({ requestedAt: null, days: [{ workoutSession: null }] })).toBe(false);
  });

  it('shows an explicitly requested new plan before its first workout', () => {
    expect(eligible({ ...cycle(), requestedAt: new Date('2026-10-29T10:00:00Z') })).toBe(true);
    expect(eligible({ requestedAt: new Date(), days: [] })).toBe(true);
  });

  it('preserves a legacy plan with actual participation including early finishes', () => {
    expect(eligible(cycle('IN_PROGRESS'))).toBe(true);
    expect(eligible(cycle('COMPLETED', null, true))).toBe(true);
    expect(eligible(cycle('PARTIAL', null, true))).toBe(true);
    // An already started session can later be skipped; do not forget the
    // athlete's participation just because the current status changed.
    expect(eligible(cycle('SKIPPED', new Date('2026-10-29T10:00:00Z')))).toBe(true);
  });

  it('requires only one actual day while ignoring null or untouched sessions', () => {
    const plan = cycle();
    plan.days.push(...cycle('PARTIAL', null, true).days);
    expect(eligible(plan)).toBe(true);
  });
});
