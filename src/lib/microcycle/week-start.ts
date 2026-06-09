// Определяет дату-понедельник для микроцикла.
//
// Правило: если сегодня понедельник — берём сегодня, иначе ближайший
// будущий понедельник. То есть атлет, который жмёт «Поехали» в субботу,
// получит цикл, стартующий с послезавтра.
//
// Все даты в UTC — чтобы не зависеть от таймзоны сервера; в БД хранится
// DATE (без времени), фронт показывает в локали юзера.

/**
 * @param now — текущий момент. Параметр, а не Date.now(), чтобы было тестируемо.
 * @returns Date представляющий 00:00:00.000 UTC понедельника недели цикла.
 */
export function getMicrocycleWeekStart(now: Date): Date {
  // Day: 0=Sun, 1=Mon, …, 6=Sat
  const day = now.getUTCDay();

  // Сколько дней добавить, чтобы попасть на ближайший Пн (вкл. сегодня).
  // Пн (1) → 0, Вт (2) → 6, Ср (3) → 5, …, Сб (6) → 2, Вс (0) → 1
  const daysUntilMonday = day === 1 ? 0 : (8 - day) % 7;

  const monday = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + daysUntilMonday,
    0, 0, 0, 0,
  ));

  return monday;
}

/**
 * Возвращает дату конкретного дня недели в микроцикле.
 * @param weekStart — понедельник (из getMicrocycleWeekStart).
 * @param dayOfWeek — 1=Пн, 2=Вт, ..., 5=Пт.
 */
export function getMicrocycleDayDate(weekStart: Date, dayOfWeek: number): Date {
  if (dayOfWeek < 1 || dayOfWeek > 5) {
    throw new Error(`dayOfWeek must be 1..5, got ${dayOfWeek}`);
  }
  return new Date(Date.UTC(
    weekStart.getUTCFullYear(),
    weekStart.getUTCMonth(),
    weekStart.getUTCDate() + (dayOfWeek - 1),
    0, 0, 0, 0,
  ));
}
