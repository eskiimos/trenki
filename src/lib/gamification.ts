// Геймификация, Фаза 1: XP, уровни, статусы-«эволюции» (см. память проекта:
// концепция «прокачиваемый хоккеист», решения босса от 2026-08-07).
//
// XP НЕ хранится в БД — считается детерминированно из уже существующей истории
// (завершённые тренировки/модули), уровни появляются у всех ретроактивно.
// Целостность записей держится СЕРВЕРНЫМИ проверками путей завершения (см.
// античит-ревью 2026-08-07: харднинг training/current PATCH → 410, cap на
// generate-v3, проверка даты в close-day, модули только из COMPLETED-сессий).
// Клиентский no-seek античит — только UX-слой, на него не полагаемся.
// Чистая логика — тестируется без БД.

/** Веса XP. Тренировка ценнее суммы модулей: бонус за доведение до конца. */
export const XP_PER_COMPLETED_WORKOUT = 100;
export const XP_PER_COMPLETED_MODULE = 20;

/** «Темп ×2»: с какого дня серии подряд включается множитель XP. */
export const TEMPO_MIN_STREAK = 3;
/** «Темп ×2»: во сколько раз умножается весь XP дня при активной серии. */
export const TEMPO_MULTIPLIER = 2;

/**
 * Ежедневный чекин: XP по дню недели (решение босса, числа обсуждаемы).
 * Индекс = getUTCDay(): 0=Вс … 6=Сб. По выходным просадка активности —
 * поэтому Сб/Вс дороже всего. Чекин НЕ даёт день серии и НЕ умножается
 * «Темпом ×2» — иначе стрик/темп фармились бы одним тапом.
 */
export const CHECKIN_XP_BY_WEEKDAY = [50, 10, 10, 10, 20, 20, 50] as const;

/** XP одного чекина по его дате (даты хранятся как @db.Date — полночь UTC). */
export function checkinXpForDate(date: Date): number {
  return CHECKIN_XP_BY_WEEKDAY[date.getUTCDay()];
}

/** Суммарный XP всех чекинов — плоское слагаемое к ретроактивному XP. */
export function checkinXp(dates: Date[]): number {
  return dates.reduce((sum, d) => sum + checkinXpForDate(d), 0);
}

export interface XpCounts {
  completedWorkouts: number;
  completedModules: number;
}

/**
 * Плоский XP по счётчикам БЕЗ учёта «Темпа ×2». Боевой путь —
 * computeXpFromHistory (считает множитель серии по датам); этот вариант
 * остаётся для песочницы админа (/admin/gamification), где дат нет.
 */
export function computeXp(c: XpCounts): number {
  const workouts = Math.max(0, Math.floor(c.completedWorkouts));
  const modules = Math.max(0, Math.floor(c.completedModules));
  return workouts * XP_PER_COMPLETED_WORKOUT + modules * XP_PER_COMPLETED_MODULE;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Календарный день как ПОРЯДКОВЫЙ НОМЕР (дней с эпохи) в таймзоне tz.
 *
 * Без tz — таймзона процесса, как раньше. Прод-контейнер жил в UTC, и «день»
 * серии переключался в 03:00 МСК: тренировка в 00:30 ночи ложилась во
 * вчерашний день, в серии возникала дырка и стрик «внезапно» сбрасывался
 * (жалоба владельца «было 3 — стало 1»). Поэтому боевые вызовы передают
 * таймзону ПОЛЬЗОВАТЕЛЯ (User.timezone, фолбэк Europe/Moscow).
 *
 * Номер дня вместо «миллисекунд полуночи»: арифметика серий идёт шагом 1, а не
 * −24ч — в таймзонах с DST сутки бывают 23/25 часов, и шаг −24ч там ломается.
 */
export function calendarDayIndex(d: Date, tz?: string | null): number {
  if (tz) {
    try {
      // en-CA → 'YYYY-MM-DD'
      const s = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(d);
      const [y, m, dd] = s.split('-').map(Number);
      return Date.UTC(y, m - 1, dd) / DAY_MS;
    } catch {
      // невалидная tz из БД — тихо падаем на таймзону процесса
    }
  }
  return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY_MS;
}

/**
 * Множитель дня D по правилу «Темп ×2»: runLength(D) ≥ TEMPO_MIN_STREAK ⇔
 * дни D, D-1, D-2 все «тренировочные» — проверять глубже не нужно, ведь
 * наличие трёх последних дней уже означает серию длиной ≥ 3, заканчивающуюся D.
 * day — номер календарного дня (calendarDayIndex).
 */
function tempoMultiplierForDay(day: number, workoutDays: ReadonlySet<number>): number {
  for (let i = 0; i < TEMPO_MIN_STREAK; i += 1) {
    if (!workoutDays.has(day - i)) return 1;
  }
  return TEMPO_MULTIPLIER;
}

/**
 * Множитель «Темпа ×2» для СЕГОДНЯШНЕГО дня по датам завершённых тренировок.
 * Нужен, чтобы показать реальный начисленный XP сразу после тренировки (тот же
 * множитель, что применяет ретроактивный расчёт к сегодняшнему дню).
 */
export function tempoMultiplierToday(
  workoutCompletedAts: Date[],
  now: Date = new Date(),
  tz?: string | null,
): number {
  const days = new Set(workoutCompletedAts.map((d) => calendarDayIndex(d, tz)));
  return tempoMultiplierForDay(calendarDayIndex(now, tz), days);
}

export interface XpFromHistory {
  xpTotal: number;
  /** Активен ли «Темп ×2» прямо сейчас (серия жива — сегодня или вчера, как computeStreak). */
  tempoActiveToday: boolean;
}

/**
 * Боевой расчёт XP из истории завершений (ретроактивно, XP в БД не хранится).
 * «Тренировочный день» — календарный день (локальная полночь) с ≥1 завершением
 * (полная COMPLETED или досрочная PARTIAL). Начиная с 3-го подряд тренировочного
 * дня весь XP того дня удваивается: тренировка 100→200, модуль 20→40. Модуль в
 * день без тренировки (в т.ч. legacy-модули без даты) — всегда ×1.
 *
 * `workoutCompletedAts` — даты ПОЛНЫХ тренировок (бонус +100 за каждую).
 * `moduleCompletedAts` — даты пройденных модулей (COMPLETED и PARTIAL сессий).
 * `trainingDayAts` — даты всех тренировочных дней для серии/темпа (COMPLETED ∪
 * PARTIAL). По умолчанию = workoutCompletedAts (обратная совместимость: когда
 * PARTIAL нет, поведение прежнее). Досрочная тренировка даёт день серии и темп,
 * но НЕ даёт бонус +100 — именно его «недозарабатываешь».
 */
export function computeXpFromHistory(
  workoutCompletedAts: Date[],
  moduleCompletedAts: Date[],
  now: Date = new Date(),
  trainingDayAts: Date[] = workoutCompletedAts,
  tz?: string | null,
): XpFromHistory {
  const workoutDays: ReadonlySet<number> = new Set(
    trainingDayAts.map((d) => calendarDayIndex(d, tz)),
  );

  let xpTotal = 0;
  for (const w of workoutCompletedAts) {
    xpTotal += XP_PER_COMPLETED_WORKOUT * tempoMultiplierForDay(calendarDayIndex(w, tz), workoutDays);
  }
  for (const m of moduleCompletedAts) {
    xpTotal += XP_PER_COMPLETED_MODULE * tempoMultiplierForDay(calendarDayIndex(m, tz), workoutDays);
  }

  // Для «активен ли темп» серию считаем честно через computeStreak (якорь —
  // сегодня либо вчера: сегодня ещё можно успеть, темп не потерян). Серия — по
  // всем тренировочным дням, включая досрочные.
  const tempoActiveToday = computeStreak(trainingDayAts, now, tz) >= TEMPO_MIN_STREAK;

  return { xpTotal, tempoActiveToday };
}

/** Количество завершений в конкретный календарный день (для недельной лиги). */
export interface DayActivityCount {
  /** Любой момент внутри дня — нормализуется к локальной полуночи. */
  day: Date;
  count: number;
}

/**
 * Недельный XP для лиги с учётом «Темпа ×2». dayCounts должны включать
 * lookback-дни (2 дня ДО weekStart): они участвуют только в определении
 * множителя (правило D, D-1, D-2), но в сумму XP не входят — суммируются
 * только дни D ≥ weekStart. Так серия Пт-Сб-Вс честно даёт ×2 с понедельника.
 *
 * `trainingDayCounts` — тренировочные дни для множителя темпа (COMPLETED ∪
 * PARTIAL): досрочный финиш держит серию/темп, хотя бонус ×100 не даёт — так
 * лига сходится с профильным XP. По умолчанию = workoutDayCounts (старое
 * поведение). tz — таймзона календарного дня (лига живёт в единой МСК).
 */
export function computeWeeklyXp(
  workoutDayCounts: DayActivityCount[],
  moduleDayCounts: DayActivityCount[],
  weekStart: Date,
  trainingDayCounts: DayActivityCount[] = workoutDayCounts,
  tz?: string | null,
): number {
  const workoutDays: ReadonlySet<number> = new Set(
    trainingDayCounts.filter((c) => c.count > 0).map((c) => calendarDayIndex(c.day, tz)),
  );
  const start = calendarDayIndex(weekStart, tz);

  let xp = 0;
  for (const c of workoutDayCounts) {
    const day = calendarDayIndex(c.day, tz);
    if (day < start) continue; // lookback — только для множителя
    xp += c.count * XP_PER_COMPLETED_WORKOUT * tempoMultiplierForDay(day, workoutDays);
  }
  for (const c of moduleDayCounts) {
    const day = calendarDayIndex(c.day, tz);
    if (day < start) continue;
    // День без тренировки автоматически даёт ×1 (его нет в workoutDays)
    xp += c.count * XP_PER_COMPLETED_MODULE * tempoMultiplierForDay(day, workoutDays);
  }
  return xp;
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
 * Стрик по датам завершённых тренировок. Серия жива, если последняя тренировка
 * сегодня или вчера; считаем подряд идущие дни назад. Дни передаются как
 * timestamps завершений (в любом порядке). tz — таймзона, в которой лежит
 * граница календарного дня (см. calendarDayIndex); без tz — таймзона процесса.
 */
export function computeStreak(
  completedAts: Date[],
  now: Date = new Date(),
  tz?: string | null,
): number {
  if (completedAts.length === 0) return 0;
  const days = new Set(completedAts.map((d) => calendarDayIndex(d, tz)));
  const today = calendarDayIndex(now, tz);
  // Якорь: сегодня, либо вчера (сегодня ещё можно успеть — серия не потеряна)
  let anchor: number;
  if (days.has(today)) anchor = today;
  else if (days.has(today - 1)) anchor = today - 1;
  else return 0;

  let streak = 0;
  while (days.has(anchor - streak)) streak += 1;
  return streak;
}
