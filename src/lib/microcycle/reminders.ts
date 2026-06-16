// Логика напоминаний о тренировке по недельному циклу (C-7).
//
// Чистая, тестируемая часть: решает, нужно ли СЕГОДНЯ напоминать выполнить
// конкретный день цикла. Здесь же зашит инвариант C-5: НЕ напоминаем про день,
// чья тренировка уже закрыта — выполнена (в т.ч. сделанная раньше срока) ИЛИ
// явно отменена пользователем. «Закрытость» берём из статуса связанной сессии
// (COMPLETED/SKIPPED), а не из календарной даты.

import { WorkoutStatus } from '@/generated/prisma';
import { getMicrocycleDayDate } from '@/lib/microcycle/week-start';

export interface ReminderDayInput {
  /** Сегодня, 00:00:00 UTC (getMicrocycleStartDate(now)). */
  today: Date;
  /** Дата дня 1 цикла (Microcycle.weekStartDate). */
  weekStartDate: Date;
  /** Порядковый день цикла, 1..5. */
  dayOfWeek: number;
  /** У дня есть привязанная WorkoutSession. */
  hasSession: boolean;
  /** Статус связанной сессии (null, если сессии нет). */
  sessionStatus: WorkoutStatus | null;
}

/**
 * Нужно ли сегодня слать напоминание про этот день цикла.
 * true только если: дата дня == сегодня, у дня есть сессия, и она НЕ завершена.
 */
export function isReminderDueForDay(d: ReminderDayInput): boolean {
  if (d.dayOfWeek < 1 || d.dayOfWeek > 5) return false;
  // Напоминаем только в день, чья календарная дата равна сегодняшней.
  if (getMicrocycleDayDate(d.weekStartDate, d.dayOfWeek).getTime() !== d.today.getTime()) {
    return false;
  }
  if (!d.hasSession) return false; // AI не нашёл модулей — дня по факту нет
  // C-5: день уже закрыт — выполнен (в т.ч. раньше расписания) ИЛИ явно
  // отменён пользователем (SKIPPED) → не напоминаем «её же».
  if (d.sessionStatus === WorkoutStatus.COMPLETED || d.sessionStatus === WorkoutStatus.SKIPPED) {
    return false;
  }
  return true;
}
