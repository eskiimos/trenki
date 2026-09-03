// C-4: логика предложения цикловой тренировки вместо быстрой.
// Чистая часть — какой день цикла предложить и порядковый день «сегодня».

export interface CycleDayLite {
  dayOfWeek: number;
  intent: string;
  workoutSession: { id: string; status: string } | null;
}

const INCOMPLETE_STATUSES = new Set(['PENDING', 'IN_PROGRESS']);

/**
 * Порядковый день недели цикла на сегодня (1..5) или null, если сегодня вне
 * окна Пн–Пт этого цикла (выходной / другая неделя). Все даты по UTC, как
 * weekStartDate (@db.Date).
 */
export function todayCycleDayIndex(weekStartDate: string | Date, now: Date): number | null {
  const ws = new Date(weekStartDate);
  const wsUTC = Date.UTC(ws.getUTCFullYear(), ws.getUTCMonth(), ws.getUTCDate());
  const todayUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const idx = Math.floor((todayUTC - wsUTC) / 86_400_000) + 1;
  return idx >= 1 && idx <= 5 ? idx : null;
}

/**
 * День цикла, который предложить вместо быстрой тренировки: сегодняшний
 * невыполненный день. Если сегодняшний день уже закрыт (выполнен / заменён
 * быстрой) — не предлагаем ничего: правка владельца «выполнил тренировку из
 * цикла, жму быструю — всё равно предлагает треню из цикла (другую цель)».
 * В выходной или в день без сессии — самый ранний невыполненный (догнать
 * пропущенный). null — предлагать нечего.
 */
export function pickCycleDayToOffer(
  days: CycleDayLite[],
  todayCycleDay: number | null,
): CycleDayLite | null {
  const incomplete = days
    .filter((d) => d.workoutSession && INCOMPLETE_STATUSES.has(d.workoutSession.status))
    .sort((a, b) => a.dayOfWeek - b.dayOfWeek);

  if (incomplete.length === 0) return null;

  if (todayCycleDay != null) {
    const today = incomplete.find((d) => d.dayOfWeek === todayCycleDay);
    if (today) return today;
    const todayDay = days.find((d) => d.dayOfWeek === todayCycleDay);
    if (todayDay?.workoutSession) return null; // сегодня уже отработал
  }
  return incomplete[0];
}
