import { describe, it, expect } from 'vitest';
import {
  STATS_TZ,
  buildDailySeries,
  dayIndexInTz,
  dayIndexToDate,
  dayLabels,
  dayWindow,
  hourInTz,
  sumLastDays,
  zonedDayStart,
} from '@/lib/stats/daily-series';
import { calendarDayIndex, dayIndexToISO } from '@/lib/gamification';

const MSK = STATS_TZ;
/** Момент по московскому «стеночному» времени. */
const msk = (s: string) => new Date(`${s}+03:00`);

describe('dayWindow — окно из 30 дней по МСК', () => {
  it('сегодня и 29 предыдущих, since — полночь МСК первого дня', () => {
    const w = dayWindow(30, msk('2026-09-21T12:00:00'), MSK);
    expect(w.lastDay - w.firstDay + 1).toBe(30);
    expect(dayIndexToDate(w.lastDay)).toBe('2026-09-21');
    expect(dayIndexToDate(w.firstDay)).toBe('2026-08-23');
    expect(w.since.toISOString()).toBe('2026-08-22T21:00:00.000Z');
  });

  it('граница суток по Москве, а не по UTC', () => {
    // 00:30 МСК 21.09 = 21:30 UTC 20.09 — по UTC это ещё «вчера»
    expect(dayIndexToDate(dayWindow(30, new Date('2026-09-20T21:30:00Z'), MSK).lastDay)).toBe('2026-09-21');
    // 23:59:59 МСК 20.09 — ещё 20-е
    expect(dayIndexToDate(dayWindow(30, new Date('2026-09-20T20:59:59Z'), MSK).lastDay)).toBe('2026-09-20');
  });

  it('days < 1 не даёт пустого окна', () => {
    const w = dayWindow(0, msk('2026-09-21T12:00:00'), MSK);
    expect(w.firstDay).toBe(w.lastDay);
  });
});

describe('buildDailySeries', () => {
  const now = msk('2026-09-21T12:00:00');
  const w = dayWindow(30, now, MSK);

  it('пустой вход → ровно 30 нулей по возрастанию дат', () => {
    const s = buildDailySeries([], w, MSK);
    expect(s).toHaveLength(30);
    expect(s.every((p) => p.count === 0)).toBe(true);
    expect(s[0].date).toBe('2026-08-23');
    expect(s[29].date).toBe('2026-09-21');
  });

  it('переход месяца без дыр: 31.08 → 01.09', () => {
    const dates = buildDailySeries([], w, MSK).map((p) => p.date);
    const i = dates.indexOf('2026-08-31');
    expect(dates[i + 1]).toBe('2026-09-01');
    // каждый следующий день ровно на сутки позже
    for (let k = 1; k < dates.length; k += 1) {
      expect(Date.parse(dates[k]) - Date.parse(dates[k - 1])).toBe(24 * 60 * 60 * 1000);
    }
  });

  it('ночь 00:00–03:00 МСК уходит в новый день, а не во вчерашний (баг UTC)', () => {
    const s = buildDailySeries(
      [
        new Date('2026-09-20T21:00:00.000Z'), // 00:00 МСК 21.09
        new Date('2026-09-20T23:59:00.000Z'), // 02:59 МСК 21.09
        new Date('2026-09-20T20:59:59.999Z'), // 23:59:59 МСК 20.09
      ],
      w,
      MSK,
    );
    const by = Object.fromEntries(s.map((p) => [p.date, p.count]));
    expect(by['2026-09-21']).toBe(2);
    expect(by['2026-09-20']).toBe(1);
  });

  it('всё вне окна отбрасывается — «огрызка» 32-го дня нет', () => {
    const s = buildDailySeries(
      [
        new Date(w.since.getTime() - 1), // 23:59:59.999 МСК накануне окна
        w.since, // ровно полночь первого дня — внутри
        msk('2026-09-22T00:00:01'), // завтра по МСК (часы клиента/БД) — вне
      ],
      w,
      MSK,
    );
    expect(s).toHaveLength(30);
    expect(s[0].count).toBe(1);
    expect(s.reduce((a, p) => a + p.count, 0)).toBe(1);
  });

  it('несколько событий в день суммируются, пустые дни остаются нулями', () => {
    const s = buildDailySeries(
      [msk('2026-09-01T10:00:00'), msk('2026-09-01T18:00:00'), msk('2026-09-03T09:00:00')],
      w,
      MSK,
    );
    const by = Object.fromEntries(s.map((p) => [p.date, p.count]));
    expect(by['2026-09-01']).toBe(2);
    expect(by['2026-09-02']).toBe(0);
    expect(by['2026-09-03']).toBe(1);
  });
});

describe('zonedDayStart', () => {
  it('Москва: полночь = 21:00 UTC предыдущей даты', () => {
    const day = dayIndexInTz(msk('2026-09-21T15:00:00'), MSK);
    expect(zonedDayStart(day, MSK).toISOString()).toBe('2026-09-20T21:00:00.000Z');
  });

  it('таймзона с летним временем: сутки перехода считаются от своей полуночи', () => {
    const NY = 'America/New_York';
    const day = (iso: string) => Date.parse(`${iso}T00:00:00Z`) / 86_400_000;
    // 08.03.2026 — переход на летнее (в 02:00): полночь ещё EST (−5)
    expect(zonedDayStart(day('2026-03-08'), NY).toISOString()).toBe('2026-03-08T05:00:00.000Z');
    expect(zonedDayStart(day('2026-03-09'), NY).toISOString()).toBe('2026-03-09T04:00:00.000Z');
    // 01.11.2026 — обратный переход: полночь ещё EDT (−4)
    expect(zonedDayStart(day('2026-11-01'), NY).toISOString()).toBe('2026-11-01T04:00:00.000Z');
    expect(zonedDayStart(day('2026-11-02'), NY).toISOString()).toBe('2026-11-02T05:00:00.000Z');
  });
});

describe('dayIndexInTz — та же семантика, что calendarDayIndex', () => {
  it('совпадает на границах суток и в разных таймзонах', () => {
    const samples = [
      '2026-09-20T20:59:59Z',
      '2026-09-20T21:00:00Z',
      '2026-12-31T21:00:00Z',
      '2026-03-08T06:30:00Z',
      '2026-01-01T00:00:00Z',
    ];
    for (const s of samples) {
      for (const tz of [MSK, 'UTC', 'Asia/Vladivostok', 'America/New_York']) {
        const d = new Date(s);
        expect(dayIndexInTz(d, tz)).toBe(calendarDayIndex(d, tz));
      }
    }
    expect(dayIndexToDate(123)).toBe(dayIndexToISO(123));
  });
});

describe('sumLastDays / hourInTz / dayLabels', () => {
  it('sumLastDays: сегодня, неделя, всё окно', () => {
    const series = Array.from({ length: 30 }, (_, i) => ({ date: `d${i}`, count: i + 1 }));
    expect(sumLastDays(series, 1)).toBe(30);
    expect(sumLastDays(series, 7)).toBe(24 + 25 + 26 + 27 + 28 + 29 + 30);
    expect(sumLastDays(series, 30)).toBe((30 * 31) / 2);
    expect(sumLastDays(series, 0)).toBe(0);
  });

  it('hourInTz: час по Москве, полночь — 0, а не 24', () => {
    expect(hourInTz(new Date('2026-09-20T21:30:00Z'), MSK)).toBe(0);
    expect(hourInTz(new Date('2026-09-21T20:59:00Z'), MSK)).toBe(23);
    expect(hourInTz(new Date('2026-09-21T09:15:00Z'), MSK)).toBe(12);
  });

  it('dayLabels: дата и день недели без сдвига таймзоны браузера', () => {
    expect(dayLabels('2026-09-21')).toEqual({ short: '21.09', weekday: 'Пн', isMonday: true });
    expect(dayLabels('2026-08-23')).toEqual({ short: '23.08', weekday: 'Вс', isMonday: false });
    expect(dayLabels('2026-09-01').weekday).toBe('Вт');
  });
});
