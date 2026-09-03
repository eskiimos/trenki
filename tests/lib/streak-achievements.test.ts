import { describe, it, expect } from 'vitest';
import {
  STREAK_ACHIEVEMENT_DEFS,
  computeStreakAchievements,
  maxStreakEver,
} from '../../src/lib/streak-achievements';

const MSK = 'Europe/Moscow';
const byKey = (list: ReturnType<typeof computeStreakAchievements>, key: string) => {
  const a = list.find((x) => x.key === key);
  if (!a) throw new Error(`нет ачивки ${key}`);
  return a;
};
/** Завершение в указанный день/час по Москве (МСК = UTC+3).
 *  Через арифметику, а не подстановку строки: для часа < 3 сдвиг уводит на
 *  предыдущие сутки UTC — это и есть проверяемый случай. */
const msk = (day: string, hour: number) =>
  new Date(new Date(`${day}T00:00:00Z`).getTime() + (hour - 3) * 3_600_000);

describe('набор «Ачивки»', () => {
  it('10 наград, ключи уникальны, у всех есть описание', () => {
    expect(STREAK_ACHIEVEMENT_DEFS.length).toBe(10);
    expect(new Set(STREAK_ACHIEVEMENT_DEFS.map((d) => d.key)).size).toBe(10);
    // «67» — эпическая, правка «Начало сентября»
    expect(STREAK_ACHIEVEMENT_DEFS.map((d) => d.key)).toContain('workouts_67');
    for (const d of STREAK_ACHIEVEMENT_DEFS) {
      expect(d.title.length).toBeGreaterThan(0);
      expect(d.description.length).toBeGreaterThan(0);
    }
  });

  it('вырезанные при ребалансе награды НЕ вернулись', () => {
    const keys = STREAK_ACHIEVEMENT_DEFS.map((d) => d.key);
    // счётчики-дубли и модульные — решение 2026-09-02
    for (const gone of ['workouts_5', 'workouts_15', 'workouts_60', 'modules_10', 'modules_300']) {
      expect(keys).not.toContain(gone);
    }
    // «месяц подряд» — вредный стимул для детского спорта
    expect(keys).not.toContain('streak_30');
  });
});

describe('maxStreakEver', () => {
  it('пусто — 0', () => {
    expect(maxStreakEver([], MSK)).toBe(0);
  });

  it('считает МАКСИМАЛЬНУЮ серию, а не текущую', () => {
    // 5 дней подряд в прошлом, потом разрыв и одиночная тренировка
    const ats = [
      msk('2026-08-01', 18), msk('2026-08-02', 18), msk('2026-08-03', 18),
      msk('2026-08-04', 18), msk('2026-08-05', 18),
      msk('2026-08-20', 18),
    ];
    expect(maxStreakEver(ats, MSK)).toBe(5);
  });

  it('несколько тренировок в один день — один день серии', () => {
    const ats = [msk('2026-08-01', 9), msk('2026-08-01', 20), msk('2026-08-02', 12)];
    expect(maxStreakEver(ats, MSK)).toBe(2);
  });

  it('ночная тренировка не рвёт серию (граница дня по таймзоне игрока)', () => {
    // 00:30 МСК 3 августа = 21:30 UTC 2 августа. В UTC серия развалилась бы.
    const ats = [msk('2026-08-01', 20), msk('2026-08-02', 20), msk('2026-08-03', 0)];
    expect(maxStreakEver(ats, MSK)).toBe(3);
    expect(maxStreakEver(ats, 'UTC')).toBe(2); // контроль: в UTC 3-го нет
  });
});

describe('Ранняя пташка', () => {
  it('тренировка в 07:00 по Москве открывает награду', () => {
    const list = computeStreakAchievements([msk('2026-08-10', 7)], MSK);
    expect(byKey(list, 'early_bird').unlocked).toBe(true);
  });

  it('тренировка в 10:00 по Москве — не открывает', () => {
    const list = computeStreakAchievements([msk('2026-08-10', 10)], MSK);
    expect(byKey(list, 'early_bird').unlocked).toBe(false);
  });

  it('КЛЮЧЕВОЕ: в 10:00 МСК (07:00 UTC) по старой логике награда выдавалась ошибочно', () => {
    const at = msk('2026-08-10', 10);
    expect(byKey(computeStreakAchievements([at], MSK), 'early_bird').unlocked).toBe(false);
    expect(byKey(computeStreakAchievements([at], 'UTC'), 'early_bird').unlocked).toBe(true);
  });
});

describe('Воин выходных', () => {
  it('суббота + воскресенье одних выходных — открыта', () => {
    // 2026-08-08 суббота, 2026-08-09 воскресенье
    const list = computeStreakAchievements([msk('2026-08-08', 12), msk('2026-08-09', 12)], MSK);
    expect(byKey(list, 'weekend_warrior').unlocked).toBe(true);
  });

  it('воскресенье + следующая суббота — НЕ одни выходные', () => {
    const list = computeStreakAchievements([msk('2026-08-09', 12), msk('2026-08-15', 12)], MSK);
    expect(byKey(list, 'weekend_warrior').unlocked).toBe(false);
  });

  it('только суббота — не открыта', () => {
    const list = computeStreakAchievements([msk('2026-08-08', 12)], MSK);
    expect(byKey(list, 'weekend_warrior').unlocked).toBe(false);
  });
});

describe('вехи объёма', () => {
  it('первая тренировка открывает «Первый лёд»', () => {
    const list = computeStreakAchievements([msk('2026-08-10', 12)], MSK);
    expect(byKey(list, 'workouts_1').unlocked).toBe(true);
    expect(byKey(list, 'workouts_30').unlocked).toBe(false);
  });

  it('прогресс обрезан по цели', () => {
    const ats = Array.from({ length: 45 }, (_, i) =>
      new Date(Date.UTC(2026, 0, 1 + i, 12)),
    );
    const list = computeStreakAchievements(ats, MSK);
    expect(byKey(list, 'workouts_30').progress).toEqual({ current: 30, target: 30 });
    expect(byKey(list, 'workouts_100').progress).toEqual({ current: 45, target: 100 });
  });

  it('пустая история — всё закрыто, ничего не падает', () => {
    const list = computeStreakAchievements([], MSK);
    expect(list.length).toBe(10);
    expect(list.every((a) => !a.unlocked)).toBe(true);
  });
});
