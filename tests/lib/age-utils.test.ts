import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  calculateAge,
  calculateAgeData,
  clampDay,
  daysInMonth,
  parseDateString,
  toDateString,
  formatDateForInput,
  getAgeGroup,
  getAgeGroupLabel,
  isValidBirthDate,
} from '@/lib/age-utils';

// Фиксируем "сегодня", чтобы тесты возраста не плыли со временем.
const FIXED_NOW = new Date('2026-05-24T12:00:00Z');

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(FIXED_NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('calculateAge', () => {
  it('считает возраст для дня рождения уже наступившего в году', () => {
    expect(calculateAge(new Date('2000-01-01'))).toBe(26);
  });

  it('вычитает 1 если день рождения ещё не наступил', () => {
    expect(calculateAge(new Date('2000-12-31'))).toBe(25);
  });

  it('для рождённых ровно сегодня — возраст полный', () => {
    expect(calculateAge(new Date('2020-05-24'))).toBe(6);
  });
});

describe('getAgeGroup', () => {
  it.each([
    [7, 'CHILD'],
    [10, 'CHILD'],
    [11, 'TEEN'],
    [17, 'TEEN'],
    [18, 'YOUNG_ADULT'],
    [34, 'YOUNG_ADULT'],
    [35, 'ADULT'],
    [70, 'ADULT'],
  ])('age=%i → %s', (age, group) => {
    expect(getAgeGroup(age)).toBe(group);
  });
});

describe('calculateAgeData', () => {
  it('принимает строку и Date', () => {
    expect(calculateAgeData('2010-01-01')).toEqual({ age: 16, ageGroup: 'TEEN' });
    expect(calculateAgeData(new Date('2010-01-01'))).toEqual({ age: 16, ageGroup: 'TEEN' });
  });
});

describe('isValidBirthDate', () => {
  it('валиден для разумных дат', () => {
    expect(isValidBirthDate('2010-01-01')).toBe(true);
  });

  it('невалиден для даты в будущем', () => {
    expect(isValidBirthDate('2050-01-01')).toBe(false);
  });

  it('невалиден для слишком молодых (<7)', () => {
    expect(isValidBirthDate('2024-01-01')).toBe(false);
  });

  it('невалиден для слишком старых (>100)', () => {
    expect(isValidBirthDate('1900-01-01')).toBe(false);
  });
});

describe('formatDateForInput', () => {
  it('возвращает YYYY-MM-DD', () => {
    expect(formatDateForInput('2010-05-24T10:00:00Z')).toBe('2010-05-24');
  });
});

describe('getAgeGroupLabel', () => {
  it('возвращает русскую метку для каждой группы', () => {
    expect(getAgeGroupLabel('CHILD')).toContain('Дети');
    expect(getAgeGroupLabel('TEEN')).toContain('Подростки');
    expect(getAgeGroupLabel('YOUNG_ADULT')).toContain('Молодые');
    expect(getAgeGroupLabel('ADULT')).toContain('Взрослые');
  });
});

// ─── Колёсики даты рождения ────────────────────────────────────────────────

describe('daysInMonth / clampDay', () => {
  it('обычные месяцы', () => {
    expect(daysInMonth(2026, 1)).toBe(31);
    expect(daysInMonth(2026, 4)).toBe(30);
  });

  it('февраль: високосный и обычный год', () => {
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2000, 2)).toBe(29); // делится на 400
    expect(daysInMonth(1900, 2)).toBe(28); // делится на 100, но не на 400
  });

  it('31 марта → февраль клампится в 28/29', () => {
    expect(clampDay(2026, 2, 31)).toBe(28);
    expect(clampDay(2024, 2, 31)).toBe(29);
  });

  it('31 мая → июнь клампится в 30', () => {
    expect(clampDay(2026, 6, 31)).toBe(30);
  });

  it('29 февраля високосного → обычный год даёт 28', () => {
    expect(clampDay(2026, 2, 29)).toBe(28);
  });

  it('корректный день не трогается', () => {
    expect(clampDay(2026, 3, 15)).toBe(15);
  });
});

describe('toDateString / parseDateString', () => {
  it('формат с ведущими нулями', () => {
    expect(toDateString(2013, 3, 7)).toBe('2013-03-07');
    expect(toDateString(2013, 12, 31)).toBe('2013-12-31');
  });

  it('без таймзонного сдвига: строка не уезжает на день', () => {
    // toISOString у локальной даты в UTC+3 дал бы предыдущий день
    expect(toDateString(2013, 1, 1)).toBe('2013-01-01');
  });

  it('круговой разбор', () => {
    expect(parseDateString(toDateString(2010, 8, 24))).toEqual({ year: 2010, month: 8, day: 24 });
  });

  it('мусор и несуществующие даты → null', () => {
    expect(parseDateString('')).toBeNull();
    expect(parseDateString(null)).toBeNull();
    expect(parseDateString('24.08.2010')).toBeNull();
    expect(parseDateString('2026-13-01')).toBeNull();
    expect(parseDateString('2026-02-30')).toBeNull();
    expect(parseDateString('2026-02-29')).toBeNull(); // не високосный
    expect(parseDateString('2024-02-29')).toEqual({ year: 2024, month: 2, day: 29 });
  });
});
