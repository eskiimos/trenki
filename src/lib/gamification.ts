// Геймификация, Фаза 1: XP, уровни, статусы-«эволюции» (см. память проекта:
// концепция «прокачиваемый хоккеист», решения босса от 2026-08-07).
//
// XP НЕ хранится в БД — считается детерминированно из уже существующей истории
// (завершённые тренировки/модули), поэтому уровни появляются у всех
// ретроактивно, а накрутить XP можно только реально завершая тренировки
// (записи создаёт только серверный флоу завершения, античит плеера уже
// защищает зачёт). Чистая логика — тестируется без БД.

/** Веса XP. Тренировка ценнее суммы модулей: бонус за доведение до конца. */
export const XP_PER_COMPLETED_WORKOUT = 100;
export const XP_PER_COMPLETED_MODULE = 20;

export interface XpCounts {
  completedWorkouts: number;
  completedModules: number;
}

export function computeXp(c: XpCounts): number {
  const workouts = Math.max(0, Math.floor(c.completedWorkouts));
  const modules = Math.max(0, Math.floor(c.completedModules));
  return workouts * XP_PER_COMPLETED_WORKOUT + modules * XP_PER_COMPLETED_MODULE;
}

/**
 * Кривая уровней: стоимость уровня N (переход N → N+1) = 100 + (N-1) * 60.
 * Уровень 1→2 стоит 100 XP (одна тренировка с модулями), дальше дороже —
 * ранние уровни дают быстрый прогресс новичку, поздние требуют регулярности.
 */
export function xpForLevel(level: number): number {
  return 100 + (Math.max(1, level) - 1) * 60;
}

export interface LevelInfo {
  level: number; // текущий уровень, от 1
  xpTotal: number;
  xpIntoLevel: number; // сколько набрано внутри текущего уровня
  xpForNext: number; // сколько всего нужно внутри уровня для перехода
}

export function levelFromXp(xpTotal: number): LevelInfo {
  const xp = Math.max(0, Math.floor(xpTotal));
  let level = 1;
  let rest = xp;
  // Линейный проход дешёв: даже 10 лет ежедневных тренировок — сотни уровней
  while (rest >= xpForLevel(level)) {
    rest -= xpForLevel(level);
    level += 1;
  }
  return { level, xpTotal: xp, xpIntoLevel: rest, xpForNext: xpForLevel(level) };
}

/**
 * Статусы-«эволюции» по уровню. Названия рабочие (хоккейная карьера) —
 * финальные придумает босс, менять только здесь. Слово «покемон» не использовать
 * нигде в продукте (ТМ Nintendo).
 */
export const STATUSES = [
  { minLevel: 1, key: 'rookie', title: 'Новичок', emoji: '🏒' },
  { minLevel: 5, key: 'prospect', title: 'Перспектива', emoji: '⛸️' },
  { minLevel: 12, key: 'junior', title: 'Юниор', emoji: '🥅' },
  { minLevel: 22, key: 'pro', title: 'Про', emoji: '🏆' },
  { minLevel: 35, key: 'allstar', title: 'Звезда', emoji: '⭐' },
  { minLevel: 50, key: 'legend', title: 'Легенда', emoji: '👑' },
] as const;

export type StatusKey = (typeof STATUSES)[number]['key'];

export function statusFromLevel(level: number) {
  // Аннотация типа: без неё as const сузил бы current до литерала первого статуса
  let current: (typeof STATUSES)[number] = STATUSES[0];
  for (const s of STATUSES) {
    if (level >= s.minLevel) current = s;
  }
  const next = STATUSES.find((s) => s.minLevel > level) ?? null;
  return { ...current, nextStatus: next };
}

/**
 * Стрик по датам завершённых тренировок (локальная полночь). Серия жива, если
 * последняя тренировка сегодня или вчера; считаем подряд идущие дни назад.
 * Дни передаются как timestamps завершений (в любом порядке).
 */
export function computeStreak(completedAts: Date[], now: Date = new Date()): number {
  if (completedAts.length === 0) return 0;
  const day = (d: Date) => {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x.getTime();
  };
  const days = new Set(completedAts.map(day));
  const DAY_MS = 24 * 60 * 60 * 1000;
  const today = day(now);
  // Якорь: сегодня, либо вчера (сегодня ещё можно успеть — серия не потеряна)
  let anchor: number;
  if (days.has(today)) anchor = today;
  else if (days.has(today - DAY_MS)) anchor = today - DAY_MS;
  else return 0;

  let streak = 0;
  while (days.has(anchor - streak * DAY_MS)) streak += 1;
  return streak;
}
