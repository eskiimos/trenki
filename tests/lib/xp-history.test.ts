import { describe, it, expect } from 'vitest';
import {
  xpEventsFromHistory,
  summarizeXpHistory,
  computeXpFromHistory,
  checkinXp,
  dayIndexToISO,
  XP_PER_COMPLETED_WORKOUT,
  XP_PER_COMPLETED_MODULE,
} from '../../src/lib/gamification';

const MSK = 'Europe/Moscow';
const at = (day: string, hour = 12) => new Date(`${day}T${String(hour).padStart(2, '0')}:00:00+03:00`);
const checkin = (day: string) => new Date(`${day}T00:00:00Z`);

describe('xpEventsFromHistory — инвариант с боевым расчётом', () => {
  it('сумма событий тренировок/модулей = computeXpFromHistory, чекинов = checkinXp', () => {
    // 5 дней подряд → с 3-го дня темп ×2
    const days = ['2026-08-10', '2026-08-11', '2026-08-12', '2026-08-13', '2026-08-14'];
    const workouts = days.map((d) => at(d, 19));
    const modules = days.flatMap((d) => [at(d, 18), at(d, 18), at(d, 19)]);
    const checkins = [checkin('2026-08-10'), checkin('2026-08-16')]; // Пн и Вс
    const events = xpEventsFromHistory(workouts, modules, workouts, checkins, MSK);

    const fromEvents = events
      .filter((e) => e.source !== 'checkin')
      .reduce((s, e) => s + e.amount, 0);
    expect(fromEvents).toBe(computeXpFromHistory(workouts, modules, at('2026-08-14'), workouts, MSK).xpTotal);
    expect(events.filter((e) => e.source === 'checkin').reduce((s, e) => s + e.amount, 0)).toBe(
      checkinXp(checkins),
    );
    // новые сверху
    for (let i = 1; i < events.length; i += 1) {
      expect(events[i - 1].at.getTime()).toBeGreaterThanOrEqual(events[i].at.getTime());
    }
  });

  it('темп: первые два дня ×1, с третьего ×2; чекин никогда не умножается', () => {
    const days = ['2026-08-10', '2026-08-11', '2026-08-12'];
    const workouts = days.map((d) => at(d));
    const events = xpEventsFromHistory(workouts, [], workouts, [checkin('2026-08-12')], MSK);
    const w = (d: string) => events.find((e) => e.source === 'workout' && e.at.getTime() === at(d).getTime())!;
    expect(w('2026-08-10').multiplier).toBe(1);
    expect(w('2026-08-11').multiplier).toBe(1);
    expect(w('2026-08-12').multiplier).toBe(2);
    expect(w('2026-08-12').amount).toBe(XP_PER_COMPLETED_WORKOUT * 2);
    const c = events.find((e) => e.source === 'checkin')!;
    expect(c.multiplier).toBe(1);
    expect(c.amount).toBe(10); // среда — будний день, 10 XP
  });
});

describe('summarizeXpHistory', () => {
  it('разбивка по источникам + бонус темпа складываются в total', () => {
    const days = ['2026-08-10', '2026-08-11', '2026-08-12'];
    const workouts = days.map((d) => at(d));
    const modules = days.map((d) => at(d, 11));
    const s = summarizeXpHistory(xpEventsFromHistory(workouts, modules, workouts, [checkin('2026-08-11')], MSK));
    expect(s.totals.workouts).toBe(3 * XP_PER_COMPLETED_WORKOUT);
    expect(s.totals.modules).toBe(3 * XP_PER_COMPLETED_MODULE);
    expect(s.totals.checkins).toBe(10); // вторник
    expect(s.totals.tempoBonus).toBe(XP_PER_COMPLETED_WORKOUT + XP_PER_COMPLETED_MODULE); // день 3 удвоен
    expect(s.totals.total).toBe(
      s.totals.workouts + s.totals.modules + s.totals.checkins + s.totals.tempoBonus,
    );
  });

  it('группирует по дням в таймзоне игрока, новые сверху; чекин попадает в свой день', () => {
    // 00:30 МСК 11.08 = 21:30 UTC 10.08 — день должен быть 11.08
    const late = new Date('2026-08-10T21:30:00Z');
    const s = summarizeXpHistory(
      xpEventsFromHistory([late], [], [late], [checkin('2026-08-11'), checkin('2026-08-09')], MSK),
    );
    expect(s.days.map((d) => d.date)).toEqual(['2026-08-11', '2026-08-09']);
    expect(s.days[0]).toMatchObject({ workouts: 1, checkin: 10, tempo: false, total: 110 });
    expect(s.days[1]).toMatchObject({ workouts: 0, checkin: 50, total: 50 }); // воскресенье
  });

  it('legacy-модули без даты уходят в отдельную строку, а не в 1970 год', () => {
    const s = summarizeXpHistory(
      xpEventsFromHistory([], [new Date(0), new Date(0)], [], [], MSK),
    );
    expect(s.days).toHaveLength(0);
    expect(s.legacy).toEqual({ modules: 2, amount: 2 * XP_PER_COMPLETED_MODULE });
    expect(s.totals.total).toBe(2 * XP_PER_COMPLETED_MODULE);
  });

  it('пустая история — нули, ничего не падает', () => {
    const s = summarizeXpHistory([]);
    expect(s.totals.total).toBe(0);
    expect(s.days).toEqual([]);
  });
});

describe('dayIndexToISO', () => {
  it('обратна номеру дня', () => {
    expect(dayIndexToISO(Date.UTC(2026, 7, 11) / 86_400_000)).toBe('2026-08-11');
  });
});
