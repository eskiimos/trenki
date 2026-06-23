import { describe, expect, it } from 'vitest';
import { planWeek, planFirstWeek, firstWeekStructure, parsePrevDay, goalsFromStoredDays, type DayState } from '@/lib/microcycle/week-plan';
import {
  getMicrocycleStartDate,
  getMicrocycleWeekStart,
  getMicrocycleDayDate,
} from '@/lib/microcycle/week-start';
import { getEffectiveStatus } from '@/lib/microcycle/status';
import {
  MicrocycleIntent,
  EnergyState,
  MicrocycleFeedback,
  MicrocycleStatus,
} from '@/generated/prisma';

// Хелпер: состояния дней по dayOfWeek для компактных проверок.
const statesByDay = (week: { dayOfWeek: number; kind: string; energyState: EnergyState }[]) =>
  Object.fromEntries(week.map((d) => [d.dayOfWeek, `${d.kind}:${d.energyState}`]));

describe('microcycle/week-plan — goalsFromStoredDays (восстановление цели дня из intent)', () => {
  for (const cycleNumber of [1, 2, 3]) {
    it(`совпадает с planWeek (цель + подпись) для цикла ${cycleNumber}`, () => {
      const plan = planWeek(null, null, cycleNumber);
      const stored = plan.map((d) => ({ dayOfWeek: d.dayOfWeek, intent: d.intent }));
      const restored = goalsFromStoredDays(stored, cycleNumber);
      expect(restored.map((d) => [d.dayOfWeek, d.goal, d.label])).toEqual(
        plan.map((d) => [d.dayOfWeek, d.goal, d.label]),
      );
    });
  }

  it('восстанавливает цель и для адаптированной (ИЗИ) недели', () => {
    const prev = planWeek(null, null, 1).map((d) => ({
      dayOfWeek: d.dayOfWeek,
      kind: d.kind,
      energyState: d.energyState,
    }));
    const plan2 = planWeek(prev, MicrocycleFeedback.EASY, 2);
    const stored = plan2.map((d) => ({ dayOfWeek: d.dayOfWeek, intent: d.intent }));
    const restored = goalsFromStoredDays(stored, 2);
    expect(restored.map((d) => d.goal)).toEqual(plan2.map((d) => d.goal));
  });
});

describe('microcycle/week-plan — стартовая неделя', () => {
  const base = planWeek(null, null, 1);

  it('5 дней Пн-Пт', () => {
    expect(base.map((d) => d.dayOfWeek)).toEqual([1, 2, 3, 4, 5]);
  });

  it('Пн полный «в тонусе», Ср полный «заряжен» (пик), Пт полный «устал» (пониженный)', () => {
    const s = statesByDay(base);
    expect(s[1]).toBe(`FULL:${EnergyState.IN_TONE}`);
    expect(s[3]).toBe(`FULL:${EnergyState.FULLY_CHARGED}`);
    expect(s[5]).toBe(`FULL:${EnergyState.TIRED}`);
  });

  it('Вт — только разминка, Чт — разминка+растяжка (лёгкие дни)', () => {
    const s = statesByDay(base);
    expect(s[2]).toMatch(/^WARMUP:/);
    expect(s[4]).toMatch(/^WARMUP_STRETCH:/);
  });

  it('у каждого дня есть цель и производный intent', () => {
    for (const d of base) {
      expect(d.goal).toBeTruthy();
      expect(d.intent).toBeTruthy();
      expect(d.label).toBeTruthy();
    }
  });

  it('полные дни недели получают разные цели (без повторов внутри недели)', () => {
    const fullGoals = base.filter((d) => d.kind === 'FULL').map((d) => d.goal);
    expect(new Set(fullGoals).size).toBe(fullGoals.length);
  });
});

describe('microcycle/week-plan — адаптация ИЗИ (усложнение)', () => {
  const prev = (): DayState[] =>
    planWeek(null, null, 1).map((d) => ({ dayOfWeek: d.dayOfWeek, kind: d.kind, energyState: d.energyState }));

  it('поднимает самый низкий полный день (Пт Устал→В тонусе) первым', () => {
    const next = planWeek(prev(), MicrocycleFeedback.EASY, 2);
    const s = statesByDay(next);
    expect(s[5]).toBe(`FULL:${EnergyState.IN_TONE}`); // Пт поднят
    expect(s[1]).toBe(`FULL:${EnergyState.IN_TONE}`); // Пн без изменений
    expect(s[3]).toBe(`FULL:${EnergyState.FULLY_CHARGED}`); // Ср без изменений
  });

  it('при равенстве низших — поднимает более ранний день (Пн раньше Пт)', () => {
    // после первого ИЗИ: Пн=В тонусе, Пт=В тонусе, Ср=Заряжен → следующий ИЗИ поднимет Пн
    const c2 = planWeek(prev(), MicrocycleFeedback.EASY, 2).map((d) => ({ dayOfWeek: d.dayOfWeek, kind: d.kind, energyState: d.energyState }));
    const c3 = planWeek(c2, MicrocycleFeedback.EASY, 3);
    const s = statesByDay(c3);
    expect(s[1]).toBe(`FULL:${EnergyState.FULLY_CHARGED}`); // Пн поднят
    expect(s[5]).toBe(`FULL:${EnergyState.IN_TONE}`); // Пт остался
  });

  it('когда все полные дни на пике — добавляет полный день (Вт из лёгкого)', () => {
    // прогоняем ИЗИ много раз пока Пн/Ср/Пт все не станут Заряжен
    let week = prev();
    for (let i = 0; i < 6; i++) {
      week = planWeek(week, MicrocycleFeedback.EASY, i + 2).map((d) => ({ dayOfWeek: d.dayOfWeek, kind: d.kind, energyState: d.energyState }));
    }
    // теперь ещё один ИЗИ должен апгрейдить лёгкий день (Вт) в полный
    const next = planWeek(week, MicrocycleFeedback.EASY, 99);
    const tue = next.find((d) => d.dayOfWeek === 2)!;
    expect(tue.kind).toBe('FULL');
  });
});

describe('microcycle/week-plan — адаптация ТЯЖКО (упрощение)', () => {
  const prev = (): DayState[] =>
    planWeek(null, null, 1).map((d) => ({ dayOfWeek: d.dayOfWeek, kind: d.kind, energyState: d.energyState }));

  it('снижает самый высокий полный день (Ср Заряжен→В тонусе) первым', () => {
    const next = planWeek(prev(), MicrocycleFeedback.HARD, 2);
    const s = statesByDay(next);
    expect(s[3]).toBe(`FULL:${EnergyState.IN_TONE}`); // Ср снижен
    expect(s[1]).toBe(`FULL:${EnergyState.IN_TONE}`); // Пн без изменений
    expect(s[5]).toBe(`FULL:${EnergyState.TIRED}`); // Пт без изменений
  });

  it('все полные дни на минимуме — структуру не ломает', () => {
    const allTired: DayState[] = [
      { dayOfWeek: 1, kind: 'FULL', energyState: EnergyState.TIRED },
      { dayOfWeek: 2, kind: 'WARMUP', energyState: EnergyState.TIRED },
      { dayOfWeek: 3, kind: 'FULL', energyState: EnergyState.TIRED },
      { dayOfWeek: 4, kind: 'WARMUP_STRETCH', energyState: EnergyState.IN_TONE },
      { dayOfWeek: 5, kind: 'FULL', energyState: EnergyState.TIRED },
    ];
    const next = planWeek(allTired, MicrocycleFeedback.HARD, 2);
    const s = statesByDay(next);
    expect(s[1]).toBe(`FULL:${EnergyState.TIRED}`);
    expect(s[3]).toBe(`FULL:${EnergyState.TIRED}`);
    expect(s[5]).toBe(`FULL:${EnergyState.TIRED}`);
  });
});

describe('microcycle/week-plan — НОРМ + ротация целей', () => {
  it('НОРМ сохраняет состояния, но меняет цели от цикла к циклу', () => {
    const c1 = planWeek(null, null, 1);
    const prev = c1.map((d) => ({ dayOfWeek: d.dayOfWeek, kind: d.kind, energyState: d.energyState }));
    const c2 = planWeek(prev, MicrocycleFeedback.NORMAL, 2);
    // состояния те же
    expect(statesByDay(c2)).toEqual(statesByDay(c1));
    // но цель Пн отличается (ротация по cycleNumber)
    expect(c2.find((d) => d.dayOfWeek === 1)!.goal).not.toBe(c1.find((d) => d.dayOfWeek === 1)!.goal);
  });

  it('наборы целей соседних недель не пересекаются (без повторов подряд)', () => {
    const c1Goals = new Set(planWeek(null, null, 1).filter((d) => d.kind === 'FULL').map((d) => d.goal));
    const prev = planWeek(null, null, 1).map((d) => ({ dayOfWeek: d.dayOfWeek, kind: d.kind, energyState: d.energyState }));
    const c2Goals = planWeek(prev, MicrocycleFeedback.NORMAL, 2).filter((d) => d.kind === 'FULL').map((d) => d.goal);
    for (const g of c2Goals) expect(c1Goals.has(g)).toBe(false);
  });
});

describe('microcycle/week-plan — parsePrevDay', () => {
  it('восстанавливает тип+состояние из intent', () => {
    expect(parsePrevDay(1, MicrocycleIntent.IN_TONE)).toMatchObject({ kind: 'FULL', energyState: EnergyState.IN_TONE });
    expect(parsePrevDay(3, MicrocycleIntent.CHARGED)).toMatchObject({ kind: 'FULL', energyState: EnergyState.FULLY_CHARGED });
    expect(parsePrevDay(5, MicrocycleIntent.TIRED)).toMatchObject({ kind: 'FULL', energyState: EnergyState.TIRED });
    expect(parsePrevDay(2, MicrocycleIntent.WARMUP)).toMatchObject({ kind: 'WARMUP' });
    expect(parsePrevDay(4, MicrocycleIntent.STRETCH)).toMatchObject({ kind: 'WARMUP_STRETCH' });
  });
});

describe('microcycle/week-start', () => {
  // Helper для построения чистого UTC Date.
  const utc = (y: number, m: number, d: number) =>
    new Date(Date.UTC(y, m - 1, d, 12, 0, 0, 0)); // полдень — чтобы не было сюрпризов

  describe('getMicrocycleStartDate (today)', () => {
    it('returns today (Mon)', () => {
      expect(getMicrocycleStartDate(utc(2026, 6, 8)).toISOString().slice(0, 10))
        .toBe('2026-06-08');
    });

    it('returns today (Wed)', () => {
      expect(getMicrocycleStartDate(utc(2026, 6, 10)).toISOString().slice(0, 10))
        .toBe('2026-06-10');
    });

    it('returns today (Sat)', () => {
      expect(getMicrocycleStartDate(utc(2026, 6, 13)).toISOString().slice(0, 10))
        .toBe('2026-06-13');
    });

    it('normalizes to 00:00:00 UTC', () => {
      const result = getMicrocycleStartDate(utc(2026, 6, 10));
      expect(result.getUTCHours()).toBe(0);
      expect(result.getUTCMinutes()).toBe(0);
      expect(result.getUTCSeconds()).toBe(0);
    });
  });

  describe('getMicrocycleWeekStart (cron, ближайший Пн)', () => {
    it('returns today if today is Monday', () => {
      expect(getMicrocycleWeekStart(utc(2026, 6, 8)).toISOString().slice(0, 10))
        .toBe('2026-06-08');
    });

    it('rounds Tuesday to next Monday', () => {
      expect(getMicrocycleWeekStart(utc(2026, 6, 9)).toISOString().slice(0, 10))
        .toBe('2026-06-15');
    });

    it('rounds Sunday to next Monday (tomorrow)', () => {
      expect(getMicrocycleWeekStart(utc(2026, 6, 14)).toISOString().slice(0, 10))
        .toBe('2026-06-15');
    });

    it('handles year boundary', () => {
      // 2026-12-31 (Thu) → 2027-01-04 (Mon)
      expect(getMicrocycleWeekStart(utc(2026, 12, 31)).toISOString().slice(0, 10))
        .toBe('2027-01-04');
    });
  });

  describe('getMicrocycleDayDate', () => {
    const start = utc(2026, 6, 10); // среда — стартуем с неё

    it('returns startDate for dayOfWeek=1', () => {
      expect(getMicrocycleDayDate(start, 1).toISOString().slice(0, 10))
        .toBe('2026-06-10');
    });

    it('returns startDate + 4 days for dayOfWeek=5', () => {
      expect(getMicrocycleDayDate(start, 5).toISOString().slice(0, 10))
        .toBe('2026-06-14');
    });

    it('throws for invalid dayOfWeek', () => {
      expect(() => getMicrocycleDayDate(start, 0)).toThrow();
      expect(() => getMicrocycleDayDate(start, 6)).toThrow();
      expect(() => getMicrocycleDayDate(start, 7)).toThrow();
    });
  });
});

describe('microcycle/getEffectiveStatus', () => {
  const monday = new Date(Date.UTC(2026, 5, 8)); // 2026-06-08 Пн
  const full = { status: MicrocycleStatus.ACTIVE, feedback: null, dayCount: 5 };

  it('ARCHIVED when feedback set', () => {
    expect(
      getEffectiveStatus(
        { ...full, status: MicrocycleStatus.ACTIVE, weekStartDate: monday, feedback: MicrocycleFeedback.NORMAL },
        new Date(Date.UTC(2026, 5, 10)),
      ),
    ).toBe('ARCHIVED');
  });

  it('ARCHIVED when DB status is ARCHIVED', () => {
    expect(
      getEffectiveStatus(
        { ...full, status: MicrocycleStatus.ARCHIVED, weekStartDate: monday },
        new Date(Date.UTC(2026, 5, 10)),
      ),
    ).toBe('ARCHIVED');
  });

  it('ACTIVE during the week (5 дней)', () => {
    expect(
      getEffectiveStatus(
        { ...full, weekStartDate: monday },
        new Date(Date.UTC(2026, 5, 10)), // Ср — внутри 5 дней
      ),
    ).toBe('ACTIVE');
  });

  it('AWAITING_FEEDBACK после 5 дней (полная неделя)', () => {
    // конец = старт + 5 = 2026-06-13 (Сб)
    expect(
      getEffectiveStatus({ ...full, weekStartDate: monday }, new Date(Date.UTC(2026, 5, 13))),
    ).toBe('AWAITING_FEEDBACK');
  });

  it('boundary: за день до конца ещё ACTIVE', () => {
    expect(
      getEffectiveStatus({ ...full, weekStartDate: monday }, new Date(Date.UTC(2026, 5, 12, 23, 0))),
    ).toBe('ACTIVE');
  });

  // Вводные недели (старт не с понедельника, < 5 дней).
  it('вводная Вт (4 дня) после цикла → AWAITING (опрос есть)', () => {
    const tue = new Date(Date.UTC(2026, 5, 9)); // Вт, dayCount 4 → конец 06-13
    expect(
      getEffectiveStatus({ status: MicrocycleStatus.ACTIVE, feedback: null, dayCount: 4, weekStartDate: tue }, new Date(Date.UTC(2026, 5, 13))),
    ).toBe('AWAITING_FEEDBACK');
  });

  it('вводная Пт (3 дня) после цикла → ARCHIVED без опроса', () => {
    const fri = new Date(Date.UTC(2026, 5, 12)); // Пт, dayCount 3 → конец 06-15
    expect(
      getEffectiveStatus({ status: MicrocycleStatus.ACTIVE, feedback: null, dayCount: 3, weekStartDate: fri }, new Date(Date.UTC(2026, 5, 15))),
    ).toBe('ARCHIVED');
  });

  it('вводная Вс (1 день) после цикла → ARCHIVED без опроса', () => {
    const sun = new Date(Date.UTC(2026, 5, 14)); // Вс, dayCount 1 → конец 06-15
    expect(
      getEffectiveStatus({ status: MicrocycleStatus.ACTIVE, feedback: null, dayCount: 1, weekStartDate: sun }, new Date(Date.UTC(2026, 5, 16))),
    ).toBe('ARCHIVED');
  });
});

describe('microcycle/firstWeekStructure — старт цикла с разных дней', () => {
  // intent-последовательности по методичке (kind+state → читаем через planFirstWeek labels)
  const dows = [
    { dow: 1, len: 5, label: 'Пн полный' },
    { dow: 2, len: 4, label: 'Вт без зарядки' },
    { dow: 3, len: 4, label: 'Ср …+Сб зарядка' },
    { dow: 4, len: 3, label: 'Чт …+Сб зарядка' },
    { dow: 5, len: 3, label: 'Пт …Вс раскисление' },
    { dow: 6, len: 2, label: 'Сб …Вс зарядка' },
    { dow: 0, len: 1, label: 'Вс только зарядка' },
  ];
  for (const { dow, len, label } of dows) {
    it(`старт dow=${dow} (${label}) → ${len} дн., dayOfWeek 1..${len}`, () => {
      const s = firstWeekStructure(dow);
      expect(s.length).toBe(len);
      expect(s.map((d) => d.dayOfWeek)).toEqual(Array.from({ length: len }, (_, i) => i + 1));
    });
  }

  it('Пн совпадает со стандартной BASE_WEEK (5 дней FULL/WARMUP/FULL/STRETCH/FULL)', () => {
    const s = firstWeekStructure(1);
    expect(s.map((d) => d.kind)).toEqual(['FULL', 'WARMUP', 'FULL', 'WARMUP_STRETCH', 'FULL']);
  });

  it('Вт-старт: первый день — полноценный (FULL), всего 4 дня, без зарядки в начале', () => {
    const plan = planFirstWeek(2, 1);
    expect(plan[0].kind).toBe('FULL');
    expect(plan.length).toBe(4);
    // в тонусе → заряжен → раскисление → устал
    expect(plan.map((d) => d.intent)).toEqual(['IN_TONE', 'CHARGED', 'STRETCH', 'TIRED']);
  });

  it('Вс-старт: один день — только зарядка (WARMUP)', () => {
    const plan = planFirstWeek(0, 1);
    expect(plan.length).toBe(1);
    expect(plan[0].kind).toBe('WARMUP');
  });
});
