// Ачивки — считаются РЕТРОАКТИВНО из уже существующей истории завершений
// (та же выборка, что у XP/уровней: см. fetchCompletionHistory в
// gamification-server.ts). В БД ничего не хранится — как и XP, ачивки
// детерминированно выводятся из timestamps, поэтому появляются у всех сразу.
// Чистая логика — тестируется без БД (tests/lib/achievements.test.ts).

import { TEMPO_MIN_STREAK } from '@/lib/gamification';

export interface AchievementDef {
  key: string;
  title: string;
  /** Условие получения по-русски — показывается под закрытой ачивкой. */
  description: string;
  emoji: string;
}

export interface AchievementState extends AchievementDef {
  unlocked: boolean;
  /** current всегда обрезан по target (для мини-прогрессбара в UI). */
  progress: { current: number; target: number };
}

/** Пороговые ачивки за количество завершённых тренировок. */
const WORKOUT_COUNT_DEFS: Array<AchievementDef & { target: number }> = [
  { key: 'workouts_1', title: 'Первый лёд', description: '1 завершённая тренировка', emoji: '🧊', target: 1 },
  { key: 'workouts_10', title: 'Десятка', description: '10 завершённых тренировок', emoji: '🔟', target: 10 },
  { key: 'workouts_50', title: 'Полтинник', description: '50 завершённых тренировок', emoji: '💪', target: 50 },
  { key: 'workouts_100', title: 'Сотня', description: '100 завершённых тренировок', emoji: '💯', target: 100 },
  { key: 'workouts_250', title: 'Машина', description: '250 завершённых тренировок', emoji: '🚂', target: 250 },
];

/** Пороговые ачивки за количество завершённых модулей. */
const MODULE_COUNT_DEFS: Array<AchievementDef & { target: number }> = [
  { key: 'modules_25', title: 'Разогрелся', description: '25 завершённых модулей', emoji: '⚡', target: 25 },
  { key: 'modules_100', title: 'Комбо', description: '100 завершённых модулей', emoji: '🎯', target: 100 },
  { key: 'modules_500', title: 'Строитель тела', description: '500 завершённых модулей', emoji: '🏗️', target: 500 },
];

/** Ачивки за МАКСИМАЛЬНУЮ серию дней подряд за всю историю (не текущий стрик!). */
const STREAK_DEFS: Array<AchievementDef & { target: number }> = [
  {
    key: 'streak_3',
    title: 'Ударный темп',
    description: `Серия ${TEMPO_MIN_STREAK} дня подряд`,
    emoji: '🔥',
    target: TEMPO_MIN_STREAK,
  },
  { key: 'streak_7', title: 'Неделя огня', description: 'Серия 7 дней подряд', emoji: '🗓️', target: 7 },
  { key: 'streak_14', title: 'Две недели подряд', description: 'Серия 14 дней подряд', emoji: '🚀', target: 14 },
  { key: 'streak_30', title: 'Железный месяц', description: 'Серия 30 дней подряд', emoji: '🏆', target: 30 },
];

const EARLY_BIRD_DEF: AchievementDef = {
  key: 'early_bird',
  title: 'Ранняя пташка',
  description: 'Заверши тренировку до 08:00',
  emoji: '🌅',
};

const WEEKEND_WARRIOR_DEF: AchievementDef = {
  key: 'weekend_warrior',
  title: 'Воин выходных',
  description: 'Тренировки в субботу и воскресенье одних выходных',
  emoji: '⚔️',
};

/** Полный набор определений — для total в API и стабильного порядка в UI. */
export const ACHIEVEMENT_DEFS: AchievementDef[] = [
  ...WORKOUT_COUNT_DEFS,
  ...MODULE_COUNT_DEFS,
  ...STREAK_DEFS,
  EARLY_BIRD_DEF,
  WEEKEND_WARRIOR_DEF,
];

/** Локальная полночь дня — тот же ключ дня, что в computeStreak/computeXpFromHistory. */
function dayStart(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Следующий календарный день через setDate — переживает переводы часов (DST). */
function nextDayKey(dayMs: number): number {
  const d = new Date(dayMs);
  d.setDate(d.getDate() + 1);
  return d.getTime();
}

/**
 * Самая длинная серия календарных дней подряд за ВСЮ историю.
 * Это не computeStreak (тот считает только живую серию от сегодня/вчера) —
 * здесь ищем максимальный run по всем дням.
 */
export function maxStreakEver(completedAts: Date[]): number {
  if (completedAts.length === 0) return 0;
  const days = [...new Set(completedAts.map((d) => dayStart(d).getTime()))].sort((a, b) => a - b);
  let best = 1;
  let run = 1;
  for (let i = 1; i < days.length; i += 1) {
    run = days[i] === nextDayKey(days[i - 1]!) ? run + 1 : 1;
    if (run > best) best = run;
  }
  return best;
}

/** Была ли суббота и воскресенье ОДНИХ выходных (вс = следующий день после сб). */
function hasWeekendPair(dayKeys: ReadonlySet<number>): boolean {
  for (const key of dayKeys) {
    if (new Date(key).getDay() === 6 && dayKeys.has(nextDayKey(key))) return true;
  }
  return false;
}

function counterState(
  def: AchievementDef & { target: number },
  count: number,
): AchievementState {
  const { target, ...rest } = def;
  return {
    ...rest,
    unlocked: count >= target,
    progress: { current: Math.min(count, target), target },
  };
}

function booleanState(def: AchievementDef, achieved: boolean): AchievementState {
  return { ...def, unlocked: achieved, progress: { current: achieved ? 1 : 0, target: 1 } };
}

/**
 * Полный расчёт ачивок из истории. workoutCompletedAts — timestamps завершённых
 * тренировок (любой порядок), moduleCount — число завершённых модулей (даты
 * модулей не нужны: у legacy-модулей их нет, а модульные ачивки — счётчиковые).
 * `_now` зарезервирован под будущие временные ачивки — текущий набор целиком
 * исторический и от «сейчас» не зависит.
 */
export function computeAchievements(
  workoutCompletedAts: Date[],
  moduleCount: number,
  _now: Date = new Date(),
): AchievementState[] {
  const workouts = workoutCompletedAts.length;
  const modules = Math.max(0, Math.floor(moduleCount));
  const bestStreak = maxStreakEver(workoutCompletedAts);
  const dayKeys: ReadonlySet<number> = new Set(
    workoutCompletedAts.map((d) => dayStart(d).getTime()),
  );
  const hasEarlyBird = workoutCompletedAts.some((d) => new Date(d).getHours() < 8);

  return [
    ...WORKOUT_COUNT_DEFS.map((def) => counterState(def, workouts)),
    ...MODULE_COUNT_DEFS.map((def) => counterState(def, modules)),
    ...STREAK_DEFS.map((def) => counterState(def, bestStreak)),
    booleanState(EARLY_BIRD_DEF, hasEarlyBird),
    booleanState(WEEKEND_WARRIOR_DEF, hasWeekendPair(dayKeys)),
  ];
}
