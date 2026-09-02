// «Ачивки» — вторая, поведенческая группа наград (правка владельца
// «Самый конец августа»: разбить награды на «Ачивки»=стрики и
// «Достижения»=древо навыков).
//
// Это восстановленный набор из прежней системы (удалён 2026-08-10 коммитом
// de9d226 при переходе на «Древо навыков»), но не целиком: из 16 старых
// вернули 9. Не вернули счётчики 5/15/60 тренировок и все модульные — они
// дублировали друг друга и дерево навыков, десять почти одинаковых плашек
// обесценивают награду. «Месяц подряд» не вернули сознательно: месяц без
// единого дня отдыха — вредный стимул для детского спорта (решение 2026-08-09).
//
// Считаются РЕТРОАКТИВНО из истории завершений — в БД ничего не хранится,
// как XP и древо. Границы дня — по ТАЙМЗОНЕ ИГРОКА: раньше «до 08:00»
// означало 08:00 серверного времени (= 11:00 МСК), а «выходные» могли
// сползать на будни.
//
// Чистая логика — тестируется без БД (tests/lib/streak-achievements.test.ts).

import { TEMPO_MIN_STREAK, calendarDayIndex } from '@/lib/gamification';

export interface StreakAchievementDef {
  key: string;
  title: string;
  /** Условие получения — показывается под закрытой наградой. */
  description: string;
}

export interface StreakAchievementState extends StreakAchievementDef {
  unlocked: boolean;
  /** current обрезан по target — для мини-прогрессбара. */
  progress: { current: number; target: number };
}

/** Вехи объёма: старт, средняя и дальняя цель. */
const WORKOUT_COUNT_DEFS: Array<StreakAchievementDef & { target: number }> = [
  { key: 'workouts_1', title: 'Первый лёд', description: '1 завершённая тренировка', target: 1 },
  { key: 'workouts_30', title: 'Тридцатка', description: '30 завершённых тренировок', target: 30 },
  { key: 'workouts_100', title: 'Сотня', description: '100 завершённых тренировок', target: 100 },
];

/** Серии: считаются по МАКСИМАЛЬНОЙ серии за всю историю, а не по текущей. */
const STREAK_DEFS: Array<StreakAchievementDef & { target: number }> = [
  {
    key: 'streak_3',
    title: 'Ударный темп',
    description: `Серия ${TEMPO_MIN_STREAK} дня подряд`,
    target: TEMPO_MIN_STREAK,
  },
  { key: 'streak_5', title: 'Пять подряд', description: 'Серия 5 дней подряд', target: 5 },
  { key: 'streak_7', title: 'Неделя огня', description: 'Серия 7 дней подряд', target: 7 },
  { key: 'streak_14', title: 'Две недели подряд', description: 'Серия 14 дней подряд', target: 14 },
];

const EARLY_BIRD_DEF: StreakAchievementDef = {
  key: 'early_bird',
  title: 'Ранняя пташка',
  description: 'Заверши тренировку до 08:00',
};

const WEEKEND_WARRIOR_DEF: StreakAchievementDef = {
  key: 'weekend_warrior',
  title: 'Воин выходных',
  description: 'Тренировки в субботу и воскресенье одних выходных',
};

/** Полный набор — для total в API и стабильного порядка в UI. */
export const STREAK_ACHIEVEMENT_DEFS: StreakAchievementDef[] = [
  ...WORKOUT_COUNT_DEFS,
  ...STREAK_DEFS,
  EARLY_BIRD_DEF,
  WEEKEND_WARRIOR_DEF,
];

/**
 * Самая длинная серия календарных дней подряд за ВСЮ историю.
 * Это не computeStreak (тот считает только живую серию от сегодня/вчера).
 * Дни — номера календарных суток в таймзоне игрока, поэтому шаг ровно +1 и
 * переводы часов/DST не ломают подсчёт.
 */
export function maxStreakEver(completedAts: Date[], tz?: string | null): number {
  if (completedAts.length === 0) return 0;
  const days = [...new Set(completedAts.map((d) => calendarDayIndex(d, tz)))].sort((a, b) => a - b);
  let best = 1;
  let run = 1;
  for (let i = 1; i < days.length; i += 1) {
    run = days[i] === days[i - 1]! + 1 ? run + 1 : 1;
    if (run > best) best = run;
  }
  return best;
}

/** Локальный час завершения в таймзоне игрока (0..23). */
function localHour(d: Date, tz?: string | null): number {
  if (tz) {
    try {
      const s = new Intl.DateTimeFormat('en-GB', {
        timeZone: tz,
        hour: '2-digit',
        hour12: false,
      }).format(d);
      const h = Number(s);
      if (Number.isInteger(h)) return h === 24 ? 0 : h;
    } catch {
      // битая таймзона из БД — падаем на таймзону процесса
    }
  }
  return d.getHours();
}

/** День недели (0=Вс … 6=Сб) по номеру календарных суток. */
function weekdayOfDayIndex(dayIndex: number): number {
  // День 0 = 1970-01-01, четверг (4)
  return (((dayIndex + 4) % 7) + 7) % 7;
}

/** Была ли суббота и воскресенье ОДНИХ выходных (вс = следующий день после сб). */
function hasWeekendPair(dayIndexes: ReadonlySet<number>): boolean {
  for (const day of dayIndexes) {
    if (weekdayOfDayIndex(day) === 6 && dayIndexes.has(day + 1)) return true;
  }
  return false;
}

function counterState(
  def: StreakAchievementDef & { target: number },
  count: number,
): StreakAchievementState {
  const { target, ...rest } = def;
  return {
    ...rest,
    unlocked: count >= target,
    progress: { current: Math.min(count, target), target },
  };
}

function booleanState(def: StreakAchievementDef, achieved: boolean): StreakAchievementState {
  return { ...def, unlocked: achieved, progress: { current: achieved ? 1 : 0, target: 1 } };
}

/**
 * Расчёт поведенческих наград из истории завершённых тренировок.
 * tz — таймзона игрока (User.timezone, фолбэк Europe/Moscow на вызывающей
 * стороне): от неё зависят и границы суток, и «до 08:00», и выходные.
 */
export function computeStreakAchievements(
  workoutCompletedAts: Date[],
  tz?: string | null,
): StreakAchievementState[] {
  const workouts = workoutCompletedAts.length;
  const bestStreak = maxStreakEver(workoutCompletedAts, tz);
  const dayIndexes: ReadonlySet<number> = new Set(
    workoutCompletedAts.map((d) => calendarDayIndex(d, tz)),
  );
  const hasEarlyBird = workoutCompletedAts.some((d) => localHour(d, tz) < 8);

  return [
    ...WORKOUT_COUNT_DEFS.map((def) => counterState(def, workouts)),
    ...STREAK_DEFS.map((def) => counterState(def, bestStreak)),
    booleanState(EARLY_BIRD_DEF, hasEarlyBird),
    booleanState(WEEKEND_WARRIOR_DEF, hasWeekendPair(dayIndexes)),
  ];
}
