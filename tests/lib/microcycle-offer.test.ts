import { describe, expect, it } from 'vitest';
import { pickCycleDayToOffer, todayCycleDayIndex, type CycleDayLite } from '@/lib/microcycle/offer';

const day = (dayOfWeek: number, status: string | null): CycleDayLite => ({
  dayOfWeek,
  intent: 'IN_TONE',
  workoutSession: status ? { id: `s${dayOfWeek}`, status } : null,
});

describe('microcycle/offer — todayCycleDayIndex', () => {
  const ws = '2026-06-15'; // понедельник

  it('Пн→1, Ср→3, Пт→5', () => {
    expect(todayCycleDayIndex(ws, new Date(Date.UTC(2026, 5, 15)))).toBe(1);
    expect(todayCycleDayIndex(ws, new Date(Date.UTC(2026, 5, 17)))).toBe(3);
    expect(todayCycleDayIndex(ws, new Date(Date.UTC(2026, 5, 19)))).toBe(5);
  });

  it('выходные / вне окна Пн-Пт → null', () => {
    expect(todayCycleDayIndex(ws, new Date(Date.UTC(2026, 5, 20)))).toBeNull(); // Сб (день 6)
    expect(todayCycleDayIndex(ws, new Date(Date.UTC(2026, 5, 14)))).toBeNull(); // до старта (день 0)
  });
});

describe('microcycle/offer — pickCycleDayToOffer', () => {
  it('возвращает сегодняшний невыполненный день', () => {
    const days = [day(1, 'COMPLETED'), day(2, 'PENDING'), day(3, 'PENDING')];
    expect(pickCycleDayToOffer(days, 3)?.dayOfWeek).toBe(3);
  });

  it('сегодняшний день выполнен → не предлагаем ничего (правка «Начало сентября»)', () => {
    const days = [day(1, 'COMPLETED'), day(2, 'PENDING'), day(3, 'COMPLETED')];
    expect(pickCycleDayToOffer(days, 3)).toBeNull();
    // PARTIAL (досрочный финиш) и SKIPPED тоже «закрыт»
    expect(pickCycleDayToOffer([day(1, 'PENDING'), day(2, 'PARTIAL')], 2)).toBeNull();
    expect(pickCycleDayToOffer([day(1, 'PENDING'), day(2, 'SKIPPED')], 2)).toBeNull();
  });

  it('выходной или день без сессии → самый ранний невыполненный', () => {
    const days = [day(1, 'COMPLETED'), day(2, 'PENDING'), day(3, 'COMPLETED')];
    expect(pickCycleDayToOffer(days, null)?.dayOfWeek).toBe(2); // выходной → ранний
    expect(pickCycleDayToOffer([day(1, 'PENDING'), day(2, null)], 2)?.dayOfWeek).toBe(1); // сегодня без сессии
    expect(pickCycleDayToOffer(days, 4)?.dayOfWeek).toBe(2); // дня 4 нет в списке
  });

  it('IN_PROGRESS считается невыполненным', () => {
    expect(pickCycleDayToOffer([day(1, 'IN_PROGRESS')], 1)?.dayOfWeek).toBe(1);
  });

  it('всё закрыто (COMPLETED/SKIPPED) или без сессий → null', () => {
    expect(pickCycleDayToOffer([day(1, 'COMPLETED'), day(2, 'SKIPPED')], 1)).toBeNull();
    expect(pickCycleDayToOffer([day(1, null)], 1)).toBeNull();
  });
});
