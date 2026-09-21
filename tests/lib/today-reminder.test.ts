import { describe, it, expect } from 'vitest';
import { pickTodayReminder, type ReminderCandidates } from '../../src/lib/training/today-reminder';
import { isActiveAssignment, activeDueCutoff, ACTIVE_OVERDUE_GRACE_DAYS } from '../../src/lib/assignments/active';

const MSK = 'Europe/Moscow';
// 21.09.2026 12:00 МСК = 09:00 UTC
const NOW = new Date('2026-09-21T09:00:00Z');
const at = (iso: string) => new Date(iso);

const empty: ReminderCandidates = { inProgress: [], todayCycleSessionId: null, pending: [] };

describe('pickTodayReminder (п.5: прерванная — только до конца дня)', () => {
  it('начатая сегодня — продолжить', () => {
    const c = { ...empty, inProgress: [{ id: 'a', startedAt: at('2026-09-21T06:00:00Z'), createdAt: at('2026-09-21T05:59:00Z') }] };
    expect(pickTodayReminder(c, NOW, MSK)).toBe('a');
  });

  it('начатая вчера — больше не предлагаем', () => {
    const c = { ...empty, inProgress: [{ id: 'a', startedAt: at('2026-09-20T17:00:00Z'), createdAt: at('2026-09-20T16:00:00Z') }] };
    expect(pickTodayReminder(c, NOW, MSK)).toBeNull();
  });

  it('граница суток — по таймзоне пользователя: 23:30 МСК вчера — это вчера, хотя в UTC ещё тот же день', () => {
    // 20.09 23:30 МСК = 20.09 20:30 UTC; сейчас 21.09 00:30 МСК = 20.09 21:30 UTC
    const now = at('2026-09-20T21:30:00Z');
    const c = { ...empty, inProgress: [{ id: 'a', startedAt: at('2026-09-20T20:30:00Z'), createdAt: at('2026-09-20T20:30:00Z') }] };
    expect(pickTodayReminder(c, now, MSK)).toBeNull();
    expect(pickTodayReminder(c, now, 'UTC')).toBe('a');
  });

  it('начатая сегодня важнее сегодняшнего дня цикла', () => {
    const c = {
      ...empty,
      inProgress: [{ id: 'quick', startedAt: at('2026-09-21T07:00:00Z'), createdAt: at('2026-09-21T07:00:00Z') }],
      todayCycleSessionId: 'cycle-day',
    };
    expect(pickTodayReminder(c, NOW, MSK)).toBe('quick');
  });

  it('нет начатой — сегодняшний день цикла', () => {
    expect(pickTodayReminder({ ...empty, todayCycleSessionId: 'cycle-day' }, NOW, MSK)).toBe('cycle-day');
  });

  it('несобранная сегодня быстрая — «начать тренировку»; вчерашняя и дни цикла — нет', () => {
    const c = {
      ...empty,
      pending: [
        { id: 'cycle-other-day', createdAt: at('2026-09-21T08:00:00Z'), isCycleDay: true },
        { id: 'quick-today', createdAt: at('2026-09-21T07:00:00Z'), isCycleDay: false },
        { id: 'quick-yesterday', createdAt: at('2026-09-20T07:00:00Z'), isCycleDay: false },
      ],
    };
    expect(pickTodayReminder(c, NOW, MSK)).toBe('quick-today');
    expect(pickTodayReminder({ ...c, pending: c.pending.filter((p) => p.id !== 'quick-today') }, NOW, MSK)).toBeNull();
  });

  it('начатая без startedAt — по дате создания', () => {
    const c = { ...empty, inProgress: [{ id: 'a', startedAt: null, createdAt: at('2026-09-21T06:00:00Z') }] };
    expect(pickTodayReminder(c, NOW, MSK)).toBe('a');
  });
});

describe('isActiveAssignment (п.10: что держит кнопку «Мои задания»)', () => {
  it('невыполненное с будущим сроком — активное', () => {
    expect(isActiveAssignment({ status: 'PENDING', dueDate: at('2026-09-25T00:00:00Z') }, NOW)).toBe(true);
  });

  it('выполненное — нет', () => {
    expect(isActiveAssignment({ status: 'COMPLETED', dueDate: at('2026-09-25T00:00:00Z') }, NOW)).toBe(false);
  });

  it(`просрочка до ${ACTIVE_OVERDUE_GRACE_DAYS} дней — ещё активное, больше — нет`, () => {
    expect(isActiveAssignment({ status: 'IN_PROGRESS', dueDate: at('2026-09-19T09:00:00Z') }, NOW)).toBe(true);
    expect(isActiveAssignment({ status: 'PENDING', dueDate: activeDueCutoff(NOW) }, NOW)).toBe(true);
    expect(isActiveAssignment({ status: 'PENDING', dueDate: at('2026-09-18T08:59:00Z') }, NOW)).toBe(false);
  });

  it('срок строкой (как из JSON API)', () => {
    expect(isActiveAssignment({ status: 'PENDING', dueDate: '2026-09-22T00:00:00.000Z' }, NOW)).toBe(true);
  });
});
