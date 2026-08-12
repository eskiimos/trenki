import { describe, it, expect } from 'vitest';
import { plural, pluralYears, pluralDays } from '@/lib/plural';

describe('plural', () => {
  const YEARS: [string, string, string] = ['год', 'года', 'лет'];

  it('1 → одна форма (год)', () => {
    expect(plural(1, YEARS)).toBe('год');
    expect(plural(21, YEARS)).toBe('год');
    expect(plural(101, YEARS)).toBe('год');
  });

  it('2-4 → форма «мало» (года)', () => {
    expect(plural(2, YEARS)).toBe('года');
    expect(plural(3, YEARS)).toBe('года');
    expect(plural(4, YEARS)).toBe('года');
    expect(plural(22, YEARS)).toBe('года');
    expect(plural(54, YEARS)).toBe('года');
  });

  it('5-20 и 11-14 → форма «много» (лет)', () => {
    expect(plural(5, YEARS)).toBe('лет');
    expect(plural(11, YEARS)).toBe('лет'); // исключение
    expect(plural(12, YEARS)).toBe('лет');
    expect(plural(14, YEARS)).toBe('лет');
    expect(plural(20, YEARS)).toBe('лет');
    expect(plural(0, YEARS)).toBe('лет');
  });

  it('pluralYears — из примеров задания', () => {
    expect(pluralYears(1)).toBe('1 год');
    expect(pluralYears(4)).toBe('4 года');
    expect(pluralYears(21)).toBe('21 год');
    expect(pluralYears(54)).toBe('54 года');
    expect(pluralYears(13)).toBe('13 лет');
  });

  it('pluralDays', () => {
    expect(pluralDays(1)).toBe('1 день');
    expect(pluralDays(2)).toBe('2 дня');
    expect(pluralDays(5)).toBe('5 дней');
  });
});
