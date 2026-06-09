// Стартовая дата микроцикла.
//
// Две стратегии:
//   - `getMicrocycleStartDate(now)` — СЕГОДНЯ (00:00 UTC). Для ручной
//     генерации после онбординга: атлет жмёт «Поехали» в среду → его
//     цикл идёт Ср/Чт/Пт/Сб/Вс, без ожидания понедельника.
//   - `getMicrocycleWeekStart(now)` — ближайший Пн (сегодня если уже Пн,
//     иначе следующий). Для cron'а авто-генерации, который запускается
//     в воскресенье и логически создаёт «следующую неделю Пн-Пт».
//
// Все даты UTC. В БД хранится DATE (без времени), фронт показывает в локали.

/** Сегодняшняя дата как 00:00:00 UTC. */
export function getMicrocycleStartDate(now: Date): Date {
  return new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    0, 0, 0, 0,
  ));
}

/** Ближайший понедельник (сегодня если Пн, иначе следующий). */
export function getMicrocycleWeekStart(now: Date): Date {
  const day = now.getUTCDay(); // 0=Sun, 1=Mon, …, 6=Sat
  const daysUntilMonday = day === 1 ? 0 : (8 - day) % 7;
  return new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + daysUntilMonday,
    0, 0, 0, 0,
  ));
}

/**
 * Возвращает дату конкретного дня микроцикла (1..5).
 * @param startDate — дата дня 1 (из getMicrocycleStartDate или WeekStart).
 */
export function getMicrocycleDayDate(startDate: Date, dayOfWeek: number): Date {
  if (dayOfWeek < 1 || dayOfWeek > 5) {
    throw new Error(`dayOfWeek must be 1..5, got ${dayOfWeek}`);
  }
  return new Date(Date.UTC(
    startDate.getUTCFullYear(),
    startDate.getUTCMonth(),
    startDate.getUTCDate() + (dayOfWeek - 1),
    0, 0, 0, 0,
  ));
}
