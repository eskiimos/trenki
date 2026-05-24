import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  calculateAge,
  calculateAgeData,
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
