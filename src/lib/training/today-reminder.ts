import { calendarDayIndex } from '@/lib/gamification';

// Какую тренировку предлагать в напоминании на главной («продолжить
// прерванную» / «начать тренировку»). Правка владельца «Середина сентября» (п.5):
// прерванная тренировка висит только до конца дня, потом предложение пропадает.
// Раньше напоминание брало ЛЮБУЮ когда-либо начатую тренировку, и брошенная
// неделю назад всплывала каждый день.
//
// «Сегодня» — по таймзоне пользователя (calendarDayIndex), как серия и чекин.
// Сегодняшний день микроцикла определяется отдельно (UTC-якорь недели) и
// приходит готовым id.

export interface ReminderCandidates {
  /** IN_PROGRESS-сессии, свежие сверху (по startedAt). */
  inProgress: Array<{ id: string; startedAt: Date | null; createdAt: Date }>;
  /** PENDING-сессия сегодняшнего дня активного микроцикла, если есть. */
  todayCycleSessionId: string | null;
  /** PENDING-сессии, свежие сверху (по createdAt). */
  pending: Array<{ id: string; createdAt: Date; isCycleDay: boolean }>;
}

export function pickTodayReminder(c: ReminderCandidates, now: Date, tz: string | null): string | null {
  const today = calendarDayIndex(now, tz);
  const isToday = (d: Date) => calendarDayIndex(d, tz) === today;

  // 1) Начатая сегодня — человек к ней и возвращается.
  const started = c.inProgress.find((s) => isToday(s.startedAt ?? s.createdAt));
  if (started) return started.id;

  // 2) Сегодняшний день недельного цикла.
  if (c.todayCycleSessionId) return c.todayCycleSessionId;

  // 3) Быстрая (или от тренера), собранная сегодня, но ещё не начатая. Дни цикла
  //    сюда не берём: вчерашний/завтрашний день цикла — не «сегодняшняя» тренировка.
  const fresh = c.pending.find((s) => !s.isCycleDay && isToday(s.createdAt));
  return fresh?.id ?? null;
}
