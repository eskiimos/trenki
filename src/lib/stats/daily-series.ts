// Ряды «по календарным дням» для графиков (админка, позже — дайджест родителю).
//
// Почему не toISOString().split('T')[0], как было в /api/admin/stats: так день
// режется по UTC, а продовый контейнер живёт в МСК (TZ=Europe/Moscow с 24.08).
// Итог — всё, что было с 00:00 до 03:00 МСК, уезжало во вчерашний день, слева
// на графике вылезал лишний 32-й «огрызок», а последний столбик не совпадал с
// KPI «сегодня». Плюс API отдавал только непустые дни, и в соседних карточках
// оказывалось разное число столбиков разной ширины («инфографика поплыла»).
//
// Здесь всё чистое (без Prisma): окно дней, начало дня в таймзоне как момент
// времени (для WHERE createdAt >= …) и ряд ровно из N дней с нулями.

/** Админская аналитика живёт в одной таймзоне — Москве (как лига). */
export const STATS_TZ = 'Europe/Moscow';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface DailyPoint {
  /** Календарный день в таймзоне ряда, 'YYYY-MM-DD'. */
  date: string;
  count: number;
}

/**
 * Окно из N календарных дней, заканчивающееся СЕГОДНЯШНИМ днём в таймзоне.
 * Дни — порядковые номера (дней с эпохи), как calendarDayIndex в gamification.
 */
export interface DayWindow {
  /** Номер первого дня окна. */
  firstDay: number;
  /** Номер последнего дня окна (сегодня в tz). */
  lastDay: number;
  /** Момент начала firstDay в tz — нижняя граница для запроса в БД. */
  since: Date;
}

// Форматтеры кешируем: создание Intl.DateTimeFormat дорогое, а бакетим мы
// тысячи строк на каждый запрос статистики (страница обновляется раз в 30 с).
// Поэтому здесь своя версия calendarDayIndex, а не вызов из gamification —
// та создаёт форматтер на каждый вызов. Семантика одна (сверено тестом).
const dayFormatters = new Map<string, Intl.DateTimeFormat>();
const partsFormatters = new Map<string, Intl.DateTimeFormat>();

function dayFormatter(tz: string): Intl.DateTimeFormat {
  let f = dayFormatters.get(tz);
  if (!f) {
    // en-CA → 'YYYY-MM-DD'
    f = new Intl.DateTimeFormat('en-CA', { timeZone: tz });
    dayFormatters.set(tz, f);
  }
  return f;
}

function partsFormatter(tz: string): Intl.DateTimeFormat {
  let f = partsFormatters.get(tz);
  if (!f) {
    // hourCycle h23: иначе часть движков отдаёт полночь как «24»
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    partsFormatters.set(tz, f);
  }
  return f;
}

/** Номер календарного дня момента d в таймзоне tz (дней с эпохи). */
export function dayIndexInTz(d: Date, tz: string): number {
  const [y, m, dd] = dayFormatter(tz).format(d).split('-').map(Number);
  return Date.UTC(y, m - 1, dd) / DAY_MS;
}

/** 'YYYY-MM-DD' по номеру дня. */
export function dayIndexToDate(day: number): string {
  return new Date(day * DAY_MS).toISOString().slice(0, 10);
}

/** Смещение таймзоны от UTC в момент instant, мс (МСК → +3ч). */
function tzOffsetMs(instant: number, tz: string): number {
  const parts = partsFormatter(tz).formatToParts(new Date(instant));
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);
  const wallAsUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  // Секунды форматтер отдаёт целыми — отбрасываем миллисекунды и у instant
  return wallAsUtc - Math.floor(instant / 1000) * 1000;
}

/**
 * Момент 00:00 календарного дня `day` в таймзоне tz. Нужен для запросов:
 * «сегодня по Москве» начинается в 21:00 UTC вчерашней даты, и
 * `new Date(y, m, d)` дал бы полночь таймзоны ПРОЦЕССА — в dev на ноутбуке
 * одна граница, в проде другая.
 *
 * Смещение берём дважды: в таймзонах с переходом на летнее время смещение в
 * полночь может отличаться от смещения в «наивной» точке. У Москвы переходов
 * нет с 2014-го, но функция общая (дайджест/пуши — по таймзоне пользователя).
 */
export function zonedDayStart(day: number, tz: string): Date {
  const wall = day * DAY_MS;
  const firstGuess = wall - tzOffsetMs(wall, tz);
  return new Date(wall - tzOffsetMs(firstGuess, tz));
}

/** Окно из `days` дней (сегодня и days−1 предыдущих) в таймзоне tz. */
export function dayWindow(days: number, now: Date, tz: string): DayWindow {
  const span = Math.max(1, Math.floor(days));
  const lastDay = dayIndexInTz(now, tz);
  const firstDay = lastDay - (span - 1);
  return { firstDay, lastDay, since: zonedDayStart(firstDay, tz) };
}

/**
 * Ряд ровно из (lastDay − firstDay + 1) точек, по возрастанию дат, с нулями
 * в пустых днях. Каждая дата из `dates` кладётся в свой календарный день по tz;
 * всё, что вне окна (запас запроса, часы «из будущего»), отбрасывается.
 */
export function buildDailySeries(dates: readonly Date[], window: DayWindow, tz: string): DailyPoint[] {
  const n = Math.max(0, window.lastDay - window.firstDay + 1);
  const counts = new Array<number>(n).fill(0);
  for (const d of dates) {
    const i = dayIndexInTz(d, tz) - window.firstDay;
    if (i >= 0 && i < n) counts[i] += 1;
  }
  return counts.map((count, i) => ({ date: dayIndexToDate(window.firstDay + i), count }));
}

/** Сумма последних `days` точек ряда («сегодня» = 1, «за неделю» = 7). */
export function sumLastDays(series: readonly DailyPoint[], days: number): number {
  if (days <= 0) return 0;
  return series.slice(-days).reduce((s, p) => s + p.count, 0);
}

/** Час (0–23) момента d в таймзоне tz — для графика «активность по часам». */
export function hourInTz(d: Date, tz: string): number {
  const parts = partsFormatter(tz).formatToParts(d);
  return Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
}

const WEEKDAYS_SHORT = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'] as const;

/**
 * Подписи дня для графика по 'YYYY-MM-DD'. Дату читаем как UTC-полночь и
 * форматируем UTC-геттерами: `new Date('2026-09-15').toLocaleDateString()`
 * в браузере западнее Гринвича показал бы 14.09.
 */
export function dayLabels(iso: string): { short: string; weekday: string; isMonday: boolean } {
  const d = new Date(`${iso}T00:00:00Z`);
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const wd = d.getUTCDay();
  return { short: `${dd}.${mm}`, weekday: WEEKDAYS_SHORT[wd], isMonday: wd === 1 };
}
