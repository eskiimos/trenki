// Эффективный статус микроцикла на конкретный момент времени.
// БД-поле Microcycle.status при создании ACTIVE; реальный «закрытие недели →
// ждём фидбэк → архив» вычисляем на лету.
//
// Правило (методичка «По повторной оценке после цикла»):
//   - ARCHIVED в БД → фидбэк уже дан/закрыт, ничего не показываем.
//   - feedback заполнен → ARCHIVED.
//   - сейчас < конца цикла (старт + кол-во дней) → ACTIVE.
//   - цикл прошёл:
//       • полная неделя (5 дней) ИЛИ вводная со старта Вт-Чт → AWAITING_FEEDBACK
//         (опрос переносимости);
//       • вводная со старта Пт-Вс (короткий ознакомительный заход) → ARCHIVED
//         без опроса: показываем только статистику, со след. недели — полный цикл.

import { MicrocycleStatus, MicrocycleFeedback } from '@/generated/prisma';

export interface CycleForStatus {
  status: MicrocycleStatus;
  weekStartDate: Date;
  feedback: MicrocycleFeedback | null;
  /** Сколько дней в цикле (для вводных недель < 5). */
  dayCount: number;
}

export type EffectiveStatus = 'ACTIVE' | 'AWAITING_FEEDBACK' | 'ARCHIVED';

export function getEffectiveStatus(cycle: CycleForStatus, now: Date): EffectiveStatus {
  if (cycle.status === MicrocycleStatus.ARCHIVED) return 'ARCHIVED';
  if (cycle.feedback) return 'ARCHIVED';

  // Конец цикла = старт + фактическое число дней (00:00 UTC дня после последнего).
  const days = cycle.dayCount > 0 ? cycle.dayCount : 5;
  const cycleEnd = new Date(Date.UTC(
    cycle.weekStartDate.getUTCFullYear(),
    cycle.weekStartDate.getUTCMonth(),
    cycle.weekStartDate.getUTCDate() + days,
    0, 0, 0, 0,
  ));
  if (now.getTime() < cycleEnd.getTime()) return 'ACTIVE';

  // Цикл прошёл. Вводная неделя Пт-Вс (короткий старт, < 5 дней) — без опроса.
  const dow = cycle.weekStartDate.getUTCDay(); // 0=Вс,1=Пн..6=Сб
  const isPartial = cycle.dayCount < 5;
  const introNoSurvey = isPartial && (dow === 5 || dow === 6 || dow === 0);
  return introNoSurvey ? 'ARCHIVED' : 'AWAITING_FEEDBACK';
}

/** Был ли это короткий вводный заход без опроса (Пт-Вс, < 5 дней) — для текста
 *  «со следующей недели — полный цикл» на экране результата. */
export function isIntroWeekNoSurvey(weekStartDate: Date, dayCount: number): boolean {
  const dow = weekStartDate.getUTCDay();
  return dayCount < 5 && (dow === 5 || dow === 6 || dow === 0);
}
