import { describe, it, expect } from 'vitest';
import {
  computeXp,
  levelFromXp,
  xpForLevel,
  statusFromLevel,
  computeStreak,
  STATUSES,
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
