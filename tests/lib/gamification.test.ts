import { describe, it, expect } from 'vitest';
import {
  computeXp,
  computeXpFromHistory,
  computeWeeklyXp,
  levelFromXp,
  xpForLevel,
  statusFromLevel,
  computeStreak,
  STATUSES,
  checkinXp,
  checkinXpForDate,
  TEMPO_MIN_STREAK,
  TEMPO_MULTIPLIER,
} from '../../src/lib/gamification';

describe('computeXp', () => {
  it('тренировка 100, модуль 20', () => {
    expect(computeXp({ completedWorkouts: 1, completedModules: 4 })).toBe(180);
    expect(computeXp({ completedWorkouts: 0, completedModules: 0 })).toBe(0);
  });
  it('отрицательные/дробные счётчики не ломают', () => {
    expect(computeXp({ completedWorkouts: -5, completedModules: 2.9 })).toBe(40);
  });
});

describe('levelFromXp', () => {
  it('старт: уровень 1, до второго нужно 100', () => {
    const l = levelFromXp(0);
    expect(l.level).toBe(1);
    expect(l.xpForNext).toBe(100);
    expect(l.xpIntoLevel).toBe(0);
  });
  it('ровно 100 XP — уровень 2 с нулём внутри', () => {
    const l = levelFromXp(100);
    expect(l.level).toBe(2);
    expect(l.xpIntoLevel).toBe(0);
    expect(l.xpForNext).toBe(160);
  });
  it('монотонность: больше XP — уровень не ниже', () => {
    let prev = 1;
    for (let xp = 0; xp <= 5000; xp += 137) {
      const l = levelFromXp(xp).level;
      expect(l).toBeGreaterThanOrEqual(prev);
      prev = l;
    }
  });
  it('инвариант: сумма стоимостей уровней + остаток = xpTotal', () => {
    const l = levelFromXp(1234);
    let spent = 0;
    for (let i = 1; i < l.level; i++) spent += xpForLevel(i);
    expect(spent + l.xpIntoLevel).toBe(1234);
  });
});

describe('statusFromLevel', () => {
  it('пороги статусов', () => {
    expect(statusFromLevel(1).key).toBe('rookie');
    expect(statusFromLevel(4).key).toBe('rookie');
    expect(statusFromLevel(5).key).toBe('prospect');
    expect(statusFromLevel(50).key).toBe('legend');
    expect(statusFromLevel(99).key).toBe('legend');
  });
  it('nextStatus указывает следующий порог, у легенды null', () => {
    expect(statusFromLevel(1).nextStatus?.key).toBe('prospect');
    expect(statusFromLevel(50).nextStatus).toBeNull();
  });
  it('пороги строго возрастают (защита от опечатки в таблице)', () => {
    for (let i = 1; i < STATUSES.length; i++) {
      expect(STATUSES[i].minLevel).toBeGreaterThan(STATUSES[i - 1].minLevel);
    }
  });
});

describe('computeStreak', () => {
  const NOW = new Date('2026-08-07T18:00:00');
  const d = (daysAgo: number, hour = 10) => {
    const x = new Date(NOW);
    x.setDate(x.getDate() - daysAgo);
    x.setHours(hour, 0, 0, 0);
    return x;
  };

  it('пусто — 0', () => {
    expect(computeStreak([], NOW)).toBe(0);
  });
  it('тренировка сегодня — 1', () => {
    expect(computeStreak([d(0)], NOW)).toBe(1);
  });
  it('вчера без сегодня — серия жива (ещё можно успеть)', () => {
    expect(computeStreak([d(1)], NOW)).toBe(1);
  });
  it('позавчера без вчера — серия мертва', () => {
    expect(computeStreak([d(2)], NOW)).toBe(0);
  });
  it('3 дня подряд с сегодняшним', () => {
    expect(computeStreak([d(0), d(1), d(2)], NOW)).toBe(3);
  });
  it('разрыв внутри серии останавливает счёт', () => {
    expect(computeStreak([d(0), d(1), d(3), d(4)], NOW)).toBe(2);
  });
  it('несколько тренировок в один день считаются одним днём', () => {
    expect(computeStreak([d(0, 9), d(0, 20), d(1)], NOW)).toBe(2);
  });
});

describe('computeXpFromHistory («Темп ×2»)', () => {
  const NOW = new Date('2026-08-07T18:00:00');
  const d = (daysAgo: number, hour = 10) => {
    const x = new Date(NOW);
    x.setDate(x.getDate() - daysAgo);
    x.setHours(hour, 0, 0, 0);
    return x;
  };

  it('константы механики: с 3-го дня серии всё ×2', () => {
    expect(TEMPO_MIN_STREAK).toBe(3);
    expect(TEMPO_MULTIPLIER).toBe(2);
  });

  it('дни 1-2 серии ×1, день 3 — ×2', () => {
    const { xpTotal } = computeXpFromHistory([d(2), d(1), d(0)], [], NOW);
    expect(xpTotal).toBe(100 + 100 + 200);
  });

  it('день 4+ тоже ×2', () => {
    const { xpTotal } = computeXpFromHistory([d(3), d(2), d(1), d(0)], [], NOW);
    expect(xpTotal).toBe(100 + 100 + 200 + 200);
  });

  it('разрыв сбрасывает серию — множитель начинается заново', () => {
    // Дни: -4, -3, (разрыв), -1, 0 — обе серии короче 3, всё ×1
    const { xpTotal } = computeXpFromHistory([d(4), d(3), d(1), d(0)], [], NOW);
    expect(xpTotal).toBe(400);
  });

  it('модуль в день без тренировки — всегда ×1', () => {
    // Тренировки: -3..-1 (день -1 уже ×2), модуль сегодня — тренировки сегодня нет
    const { xpTotal } = computeXpFromHistory([d(3), d(2), d(1)], [d(0)], NOW);
    expect(xpTotal).toBe(100 + 100 + 200 + 20);
  });

  it('модуль в ×2-день удваивается, в 1-й день серии — нет', () => {
    const workouts = [d(2), d(1), d(0)];
    const inTempo = computeXpFromHistory(workouts, [d(0)], NOW);
    expect(inTempo.xpTotal).toBe(400 + 40);
    const beforeTempo = computeXpFromHistory(workouts, [d(2)], NOW);
    expect(beforeTempo.xpTotal).toBe(400 + 20);
  });

  it('детерминизм: порядок дат не влияет, повторный вызов даёт то же', () => {
    const workouts = [d(0), d(3), d(1), d(2)];
    const modules = [d(1), d(0), d(0)];
    const a = computeXpFromHistory(workouts, modules, NOW);
    const b = computeXpFromHistory([...workouts].reverse(), [...modules].reverse(), NOW);
    expect(a).toEqual(b);
  });

  it('tempoActiveToday: серия из 3 с сегодняшним днём — активен', () => {
    expect(computeXpFromHistory([d(2), d(1), d(0)], [], NOW).tempoActiveToday).toBe(true);
  });

  it('tempoActiveToday: серия из 3, последняя вчера — ещё активен (как computeStreak)', () => {
    expect(computeXpFromHistory([d(3), d(2), d(1)], [], NOW).tempoActiveToday).toBe(true);
  });

  it('tempoActiveToday: серия из 2 — ещё не активен', () => {
    expect(computeXpFromHistory([d(1), d(0)], [], NOW).tempoActiveToday).toBe(false);
  });

  it('tempoActiveToday: серия оборвалась позавчера — не активен, но XP той серии остаётся ×2', () => {
    const r = computeXpFromHistory([d(4), d(3), d(2)], [], NOW);
    expect(r.tempoActiveToday).toBe(false);
    expect(r.xpTotal).toBe(100 + 100 + 200); // ретроактивный ×2 за 3-й день не сгорает
  });
});

describe('computeXpFromHistory — досрочный финиш (PARTIAL)', () => {
  const NOW = new Date('2026-08-07T18:00:00');
  const d = (daysAgo: number, hour = 10) => {
    const x = new Date(NOW);
    x.setDate(x.getDate() - daysAgo);
    x.setHours(hour, 0, 0, 0);
    return x;
  };

  it('досрочная тренировка: только 20×модули, без бонуса +100', () => {
    // Полных тренировок нет (workoutAts пуст), 2 пройденных модуля сегодня,
    // сегодня — тренировочный день (PARTIAL передаётся через trainingDayAts).
    const { xpTotal } = computeXpFromHistory([], [d(0), d(0)], NOW, [d(0)]);
    expect(xpTotal).toBe(40);
  });

  it('день досрочной тренировки продлевает серию и даёт «Темп ×2»', () => {
    const workouts = [d(2), d(1)]; // 2 полные тренировки
    const modules = [d(0)]; // модуль сегодня (досрочная)
    const trainingDays = [d(2), d(1), d(0)]; // 3 тренировочных дня подряд
    const { xpTotal, tempoActiveToday } = computeXpFromHistory(workouts, modules, NOW, trainingDays);
    // дни -2, -1 — ×1 (100+100), сегодня 3-й день серии → модуль ×2 = 40
    expect(xpTotal).toBe(240);
    expect(tempoActiveToday).toBe(true);
  });

  it('без trainingDayAts поведение прежнее (обратная совместимость)', () => {
    const a = computeXpFromHistory([d(2), d(1), d(0)], [d(0)], NOW);
    const b = computeXpFromHistory([d(2), d(1), d(0)], [d(0)], NOW, [d(2), d(1), d(0)]);
    expect(a).toEqual(b);
  });
});

describe('computeWeeklyXp (недельная лига с «Темпом ×2»)', () => {
  // Неделя с Пн 2026-08-03; lookback лиги — Сб 08-01 и Вс 08-02
  const WEEK_START = new Date('2026-08-03T00:00:00');
  const day = (iso: string) => new Date(`${iso}T00:00:00`);

  it('понедельник продолжает серию Сб-Вс — ×2 сразу с понедельника, lookback в сумму не входит', () => {
    const workouts = [
      { day: day('2026-08-01'), count: 1 }, // Сб (lookback)
      { day: day('2026-08-02'), count: 1 }, // Вс (lookback)
      { day: day('2026-08-03'), count: 1 }, // Пн — 3-й день серии
    ];
    expect(computeWeeklyXp(workouts, [], WEEK_START)).toBe(200);
  });

  it('серия со среды — ×2 только с пятницы', () => {
    const workouts = [
      { day: day('2026-08-05'), count: 1 }, // Ср ×1
      { day: day('2026-08-06'), count: 1 }, // Чт ×1
      { day: day('2026-08-07'), count: 1 }, // Пт ×2
    ];
    expect(computeWeeklyXp(workouts, [], WEEK_START)).toBe(100 + 100 + 200);
  });

  it('модули: в ×2-день удваиваются, в день без тренировки ×1', () => {
    const workouts = [
      { day: day('2026-08-03'), count: 1 }, // Пн ×1
      { day: day('2026-08-04'), count: 1 }, // Вт ×1
      { day: day('2026-08-05'), count: 2 }, // Ср — 3-й день, 2 тренировки ×2
    ];
    const modules = [
      { day: day('2026-08-05'), count: 2 }, // Ср: 2 модуля ×2
      { day: day('2026-08-06'), count: 1 }, // Чт: тренировки нет — ×1
    ];
    // Пн 100 + Вт 100 + Ср 2×100×2 + модули Ср 2×20×2 + модуль Чт 20
    expect(computeWeeklyXp(workouts, modules, WEEK_START)).toBe(100 + 100 + 400 + 80 + 20);
  });

  it('PARTIAL-день (trainingDayCounts) держит темп, не давая бонус ×100', () => {
    // Пн/Вт — полные тренировки, Ср — только досрочная (PARTIAL, 0 в workouts).
    // Ср присутствует в trainingDays → серия Пн-Вт-Ср жива, и модуль среды ×2.
    const workouts = [
      { day: day('2026-08-03'), count: 1 },
      { day: day('2026-08-04'), count: 1 },
    ];
    const trainingDays = [
      ...workouts,
      { day: day('2026-08-05'), count: 1 },
    ];
    const modules = [{ day: day('2026-08-05'), count: 2 }];
    expect(computeWeeklyXp(workouts, modules, WEEK_START, trainingDays)).toBe(
      100 + 100 + 2 * 20 * 2,
    );
  });
});

// ─── Таймзоны: граница календарного дня ──────────────────────────────────────
// Прод-контейнер жил в UTC → «день» переключался в 03:00 МСК, и тренировка в
// 00:30 ночи ложилась во вчерашний день: серия рвалась при непрерывной, по
// ощущению пользователя, активности (жалоба «было 3 — стало 1»).

describe('computeStreak с таймзоной пользователя', () => {
  it('ночная тренировка (00:30 МСК = 21:30 UTC вчера) остаётся в СВОЁМ дне', () => {
    // Пн 20:00, Вт 20:00, Ср 20:00 МСК, затем Чт 00:30 МСК (= Ср 21:30 UTC).
    // В UTC четверг пуст → разрыв; в МСК серия непрерывна: Пн-Вт-Ср-Чт = 4.
    const ats = [
      new Date('2026-08-03T17:00:00Z'), // Пн 20:00 МСК
      new Date('2026-08-04T17:00:00Z'), // Вт 20:00 МСК
      new Date('2026-08-05T17:00:00Z'), // Ср 20:00 МСК
      new Date('2026-08-05T21:30:00Z'), // Чт 00:30 МСК ← в UTC ещё среда
    ];
    const now = new Date('2026-08-06T09:00:00Z'); // Чт 12:00 МСК
    expect(computeStreak(ats, now, 'Europe/Moscow')).toBe(4);
    // Контроль: в UTC та же история даёт лишь 1 (сегодня-«четверг» в UTC пуст,
    // якорь падает на вчера, а перед средой стоят Пн-Вт) — стрик «сбит».
    expect(computeStreak(ats, now, 'UTC')).toBe(3);
    const fri = new Date('2026-08-07T09:00:00Z'); // Пт: в UTC якорь=чт? чт пуст в UTC
    expect(computeStreak([...ats, new Date('2026-08-07T06:00:00Z')], fri, 'UTC')).toBe(1);
    expect(computeStreak([...ats, new Date('2026-08-07T06:00:00Z')], fri, 'Europe/Moscow')).toBe(5);
  });

  it('серия через переход на летнее время (DST) не рвётся', () => {
    // Берлин, март 2026: 29.03 сутки длятся 23 часа. Шаг «−24ч» тут ломался бы.
    const ats = [
      new Date('2026-03-27T19:00:00Z'), // Пт 20:00 Берлин
      new Date('2026-03-28T19:00:00Z'), // Сб 20:00
      new Date('2026-03-29T18:00:00Z'), // Вс 20:00 (уже UTC+2)
    ];
    const now = new Date('2026-03-29T20:00:00Z');
    expect(computeStreak(ats, now, 'Europe/Berlin')).toBe(3);
  });

  it('битая таймзона из БД не роняет расчёт (фолбэк на таймзону процесса)', () => {
    const ats = [new Date('2026-08-06T10:00:00Z')];
    expect(() => computeStreak(ats, new Date('2026-08-06T12:00:00Z'), 'Bad/Zone')).not.toThrow();
  });
});

// ─── Ежедневный чекин (правки «Конец августа») ───────────────────────────────

describe('checkinXp', () => {
  it('числа по дням недели: Пн-Ср 10, Чт-Пт 20, Сб-Вс 50', () => {
    // 2026-08-24 — понедельник (UTC)
    expect(checkinXpForDate(new Date('2026-08-24T00:00:00Z'))).toBe(10); // Пн
    expect(checkinXpForDate(new Date('2026-08-26T00:00:00Z'))).toBe(10); // Ср
    expect(checkinXpForDate(new Date('2026-08-27T00:00:00Z'))).toBe(20); // Чт
    expect(checkinXpForDate(new Date('2026-08-28T00:00:00Z'))).toBe(20); // Пт
    expect(checkinXpForDate(new Date('2026-08-29T00:00:00Z'))).toBe(50); // Сб
    expect(checkinXpForDate(new Date('2026-08-30T00:00:00Z'))).toBe(50); // Вс
  });

  it('сумма недели полного чекина = 170', () => {
    const week = Array.from(
      { length: 7 },
      (_, i) => new Date(Date.UTC(2026, 7, 24 + i)),
    );
    expect(checkinXp(week)).toBe(10 + 10 + 10 + 20 + 20 + 50 + 50);
  });

  it('пустой список — 0', () => {
    expect(checkinXp([])).toBe(0);
  });
});
