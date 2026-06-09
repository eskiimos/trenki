// Эффективный статус микроцикла на конкретный момент времени.
// БД-поле Microcycle.status в Sprint 1 всегда ACTIVE при создании; реальный
// «закрытие недели → ждём фидбэк → архив» переход появляется в Sprint 5
// (cron). До этого вычисляем «нужен ли фидбэк» на лету.
//
// Правило:
//   - ARCHIVED в БД → фидбэк уже дан, ничего не показываем.
//   - feedback заполнен → ARCHIVED (даже если в БД ещё ACTIVE — данные опередили).
//   - сейчас >= weekStartDate + 7 дней → COMPLETED (ждём фидбэк).
//   - иначе — ACTIVE.

import { MicrocycleStatus, MicrocycleFeedback } from '@/generated/prisma';

export interface CycleForStatus {
  status: MicrocycleStatus;
  weekStartDate: Date;
  feedback: MicrocycleFeedback | null;
}

export type EffectiveStatus = 'ACTIVE' | 'AWAITING_FEEDBACK' | 'ARCHIVED';

export function getEffectiveStatus(cycle: CycleForStatus, now: Date): EffectiveStatus {
  if (cycle.status === MicrocycleStatus.ARCHIVED) return 'ARCHIVED';
  if (cycle.feedback) return 'ARCHIVED';

  // weekEndDate = weekStartDate + 7 дней (Пн следующей недели в 00:00 UTC).
  const weekEnd = new Date(Date.UTC(
    cycle.weekStartDate.getUTCFullYear(),
    cycle.weekStartDate.getUTCMonth(),
    cycle.weekStartDate.getUTCDate() + 7,
    0, 0, 0, 0,
  ));

  if (now.getTime() >= weekEnd.getTime()) return 'AWAITING_FEEDBACK';
  return 'ACTIVE';
}
