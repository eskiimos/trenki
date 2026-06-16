import { describe, expect, it } from 'vitest';
import { isReminderDueForDay } from '@/lib/microcycle/reminders';
import { WorkoutStatus } from '@/generated/prisma';

// Неделя цикла: Пн 2026-06-15 → день 3 (Ср) == 2026-06-17.
const weekStartDate = new Date(Date.UTC(2026, 5, 15));
const today = new Date(Date.UTC(2026, 5, 17)); // среда, день 3

const base = {
  today,
  weekStartDate,
  dayOfWeek: 3,
  hasSession: true,
  sessionStatus: WorkoutStatus.PENDING as WorkoutStatus | null,
};

describe('microcycle/reminders — isReminderDueForDay (C-5 guard)', () => {
  it('напоминает в день цикла, если тренировка не выполнена', () => {
    expect(isReminderDueForDay(base)).toBe(true);
    expect(isReminderDueForDay({ ...base, sessionStatus: WorkoutStatus.IN_PROGRESS })).toBe(true);
  });

  it('C-5: НЕ напоминает, если день уже выполнен (в т.ч. раньше срока)', () => {
    expect(isReminderDueForDay({ ...base, sessionStatus: WorkoutStatus.COMPLETED })).toBe(false);
  });

  it('C-5: НЕ напоминает, если день явно отменён пользователем (SKIPPED)', () => {
    expect(isReminderDueForDay({ ...base, sessionStatus: WorkoutStatus.SKIPPED })).toBe(false);
  });

  it('не напоминает, если у дня нет сессии', () => {
    expect(isReminderDueForDay({ ...base, hasSession: false, sessionStatus: null })).toBe(false);
  });

  it('не напоминает в чужой день (дата дня != сегодня)', () => {
    // день 1 (Пн 15-е) и день 5 (Пт 19-е) — не сегодня
    expect(isReminderDueForDay({ ...base, dayOfWeek: 1 })).toBe(false);
    expect(isReminderDueForDay({ ...base, dayOfWeek: 5 })).toBe(false);
  });

  it('не напоминает для dayOfWeek вне 1..5 (выходные)', () => {
    expect(isReminderDueForDay({ ...base, dayOfWeek: 6 })).toBe(false);
    expect(isReminderDueForDay({ ...base, dayOfWeek: 0 })).toBe(false);
  });
});
