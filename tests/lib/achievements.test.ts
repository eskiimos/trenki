import { describe, it, expect } from 'vitest';
import {
  ACHIEVEMENT_DEFS,
  computeAchievements,
  maxStreakEver,
} from '../../src/lib/achievements';

/** Локальная дата: год/месяц(1-12)/день/час. */
const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h, 0, 0);

/** n тренировок в разные дни (без серий: шаг 3 дня). */
const workouts = (n: number) => Array.from({ length: n }, (_, i) => at(2025, 1, 1 + i * 3));

const byKey = (list: ReturnType<typeof computeAchievements>, key: string) => {
  const a = list.find((x) => x.key === key);
  if (!a) throw new Error(`нет ачивки ${key}`);
  return a;
};

describe('набор ачивок', () => {
  it('14 штук, ключи уникальны, у всех есть описание и эмодзи', () => {
    expect(ACHIEVEMENT_DEFS.length).toBe(14);
    expect(new Set(ACHIEVEMENT_DEFS.map((d) => d.key)).size).toBe(14);
    for (const d of ACHIEVEMENT_DEFS) {
      expect(d.title.length).toBeGreaterThan(0);
      expect(d.description.length).toBeGreaterThan(0);
      expect(d.emoji.length).toBeGreaterThan(0);
    }
    expect(computeAchievements([], 0).length).toBe(14);
  });
});

describe('пороги тренировок', () => {
  it('unlocked ровно на границе: 1 → «Первый лёд», 9 ≠ «Десятка», 10 = «Десятка»', () => {
    expect(byKey(computeAchievements([], 0), 'workouts_1').unlocked).toBe(false);
    expect(byKey(computeAchievements(workouts(1), 0), 'workouts_1').unlocked).toBe(true);
    expect(byKey(computeAchievements(workouts(9), 0), 'workouts_10').unlocked).toBe(false);
    expect(byKey(computeAchievements(workouts(10), 0), 'workouts_10').unlocked).toBe(true);
  });

  it('progress обрезан по target', () => {
    const a = byKey(computeAchievements(workouts(37), 0), 'workouts_10');
    expect(a.progress).toEqual({ current: 10, target: 10 });
    const b = byKey(computeAchievements(workouts(37), 0), 'workouts_50');
    expect(b.progress).toEqual({ current: 37, target: 50 });
  });
});

describe('пороги модулей (moduleCount)', () => {
  it('25/100/500 ровно на границе', () => {
    const under = computeAchievements([], 24);
    expect(byKey(under, 'modules_25').unlocked).toBe(false);
    expect(byKey(under, 'modules_25').progress.current).toBe(24);
    const exact = computeAchievements([], 25);
    expect(byKey(exact, 'modules_25').unlocked).toBe(true);
    const many = computeAchievements([], 500);
    expect(byKey(many, 'modules_100').unlocked).toBe(true);
    expect(byKey(many, 'modules_500').unlocked).toBe(true);
    expect(byKey(many, 'modules_500').progress).toEqual({ current: 500, target: 500 });
  });
});

describe('maxStreakEver — максимальная серия за историю', () => {
  it('пусто → 0, один день → 1, дубли одного дня не раздувают серию', () => {
    expect(maxStreakEver([])).toBe(0);
    expect(maxStreakEver([at(2025, 3, 10)])).toBe(1);
    expect(maxStreakEver([at(2025, 3, 10, 7), at(2025, 3, 10, 19), at(2025, 3, 10, 22)])).toBe(1);
  });

  it('находит самый длинный run, а не текущий стрик (серия давно в прошлом)', () => {
    const ats = [
      // Серия из 4 дней год назад
      at(2024, 5, 1), at(2024, 5, 2), at(2024, 5, 3), at(2024, 5, 4),
      // Разрыв, потом серия из 2
      at(2024, 5, 10), at(2024, 5, 11),
    ];
    expect(maxStreakEver(ats)).toBe(4);
    // «Ударный темп» (3 подряд) разблокирован ИСТОРИЧЕСКОЙ серией,
    // хотя текущий стрик относительно сегодня равен 0.
    const a = byKey(computeAchievements(ats, 0), 'streak_3');
    expect(a.unlocked).toBe(true);
  });

  it('серия через границу месяца', () => {
    expect(maxStreakEver([at(2025, 1, 30), at(2025, 1, 31), at(2025, 2, 1)])).toBe(3);
  });

  it('пороги серий ровно на границе: 7 дней = «Неделя огня», 6 — нет', () => {
    const run = (n: number) => Array.from({ length: n }, (_, i) => at(2025, 6, 1 + i));
    expect(byKey(computeAchievements(run(6), 0), 'streak_7').unlocked).toBe(false);
    const seven = computeAchievements(run(7), 0);
    expect(byKey(seven, 'streak_7').unlocked).toBe(true);
    expect(byKey(seven, 'streak_7').progress).toEqual({ current: 7, target: 7 });
    expect(byKey(seven, 'streak_14').progress).toEqual({ current: 7, target: 14 });
    expect(byKey(computeAchievements(run(30), 0), 'streak_30').unlocked).toBe(true);
  });
});

describe('«Ранняя пташка» — тренировка до 08:00 локального', () => {
  it('07:59 даёт, 08:00 — нет', () => {
    const early = computeAchievements([new Date(2025, 3, 10, 7, 59)], 0);
    expect(byKey(early, 'early_bird').unlocked).toBe(true);
    const late = computeAchievements([new Date(2025, 3, 10, 8, 0)], 0);
    expect(byKey(late, 'early_bird').unlocked).toBe(false);
    expect(byKey(late, 'early_bird').progress).toEqual({ current: 0, target: 1 });
  });
});

describe('«Воин выходных» — сб и вс ОДНОЙ недели', () => {
  // 2025-06-07 — суббота, 2025-06-08 — воскресенье
  it('суббота + следующее воскресенье → разблокирована', () => {
    const a = computeAchievements([at(2025, 6, 7), at(2025, 6, 8)], 0);
    expect(byKey(a, 'weekend_warrior').unlocked).toBe(true);
  });

  it('суббота одной недели + воскресенье другой → НЕ разблокирована', () => {
    // сб 2025-06-07 и вс 2025-06-15 (следующая неделя)
    const a = computeAchievements([at(2025, 6, 7), at(2025, 6, 15)], 0);
    expect(byKey(a, 'weekend_warrior').unlocked).toBe(false);
    // и наоборот: вс 2025-06-08 + сб 2025-06-14 — тоже разные выходные
    const b = computeAchievements([at(2025, 6, 8), at(2025, 6, 14)], 0);
    expect(byKey(b, 'weekend_warrior').unlocked).toBe(false);
  });

  it('будние дни подряд не считаются выходными', () => {
    // пн-вт 2025-06-09/10
    const a = computeAchievements([at(2025, 6, 9), at(2025, 6, 10)], 0);
    expect(byKey(a, 'weekend_warrior').unlocked).toBe(false);
  });
});
