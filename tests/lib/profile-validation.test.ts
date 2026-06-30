import { describe, expect, it } from 'vitest';
import {
  sanitizeName,
  isValidName,
  sanitizeNumberInput,
  isValidGameNumber,
  NAME_MAX_FIRST,
  NAME_MAX_LAST,
  isValidHeight,
  isValidWeight,
  clampHeight,
  clampWeight,
  HEIGHT_MIN,
  HEIGHT_MAX,
  WEIGHT_MIN,
  WEIGHT_MAX,
} from '@/lib/profile-validation';

describe('sanitizeName', () => {
  it('оставляет кириллицу и дефис, латиницу убирает', () => {
    expect(sanitizeName('Иван-Пётр', NAME_MAX_LAST)).toBe('Иван-Пётр');
    expect(sanitizeName('Anna-Maria', NAME_MAX_LAST)).toBe('-'); // латиница вырезана, остаётся дефис
    expect(sanitizeName('Bob', NAME_MAX_LAST)).toBe('');
  });

  it('вырезает цифры, пробелы, спецсимволы и латиницу', () => {
    expect(sanitizeName('Ив4ан Пе!тр', NAME_MAX_LAST)).toBe('ИванПетр');
    expect(sanitizeName('O’Brien 99', NAME_MAX_LAST)).toBe('');
  });

  it('сохраняет Ёё', () => {
    expect(sanitizeName('Артём', NAME_MAX_FIRST)).toBe('Артём');
    expect(sanitizeName('ёлка', NAME_MAX_FIRST)).toBe('ёлка');
  });

  it('обрезает до максимальной длины', () => {
    expect(sanitizeName('Александрович', NAME_MAX_FIRST)).toHaveLength(NAME_MAX_FIRST);
    expect(sanitizeName('а'.repeat(30), NAME_MAX_LAST)).toHaveLength(NAME_MAX_LAST);
  });
});

describe('isValidName', () => {
  it('принимает кириллицу ≥2 букв, отклоняет пустую/латиницу/1 букву', () => {
    expect(isValidName('Иван', NAME_MAX_FIRST)).toBe(true);
    expect(isValidName('Ян', NAME_MAX_FIRST)).toBe(true);
    expect(isValidName('Анна-Мария', NAME_MAX_LAST)).toBe(true);
    expect(isValidName('', NAME_MAX_FIRST)).toBe(false);
    expect(isValidName('Я', NAME_MAX_FIRST)).toBe(false);
    expect(isValidName('Bob', NAME_MAX_FIRST)).toBe(false);
  });

  it('отклоняет пробелы, цифры и превышение длины', () => {
    expect(isValidName('Ван Дам', NAME_MAX_LAST)).toBe(false);
    expect(isValidName('Иван1', NAME_MAX_FIRST)).toBe(false);
    expect(isValidName('а'.repeat(11), NAME_MAX_FIRST)).toBe(false);
  });

  it('отклоняет имена из одних дефисов', () => {
    expect(isValidName('-', NAME_MAX_FIRST)).toBe(false);
    expect(isValidName('--', NAME_MAX_FIRST)).toBe(false);
    expect(isValidName('---', NAME_MAX_LAST)).toBe(false);
  });
});

describe('sanitizeNumberInput', () => {
  it('оставляет максимум 2 цифры', () => {
    expect(sanitizeNumberInput('7')).toBe('7');
    expect(sanitizeNumberInput('99')).toBe('99');
    expect(sanitizeNumberInput('123')).toBe('12');
  });

  it('вырезает не-цифры', () => {
    expect(sanitizeNumberInput('a7b')).toBe('7');
    expect(sanitizeNumberInput('-5')).toBe('5');
  });

  it('убирает ведущие нули (0/00 → пусто)', () => {
    expect(sanitizeNumberInput('0')).toBe('');
    expect(sanitizeNumberInput('00')).toBe('');
    expect(sanitizeNumberInput('07')).toBe('7');
    expect(sanitizeNumberInput('012')).toBe('12');
  });
});

describe('isValidGameNumber', () => {
  it('принимает 1..99 и пусто', () => {
    expect(isValidGameNumber(1)).toBe(true);
    expect(isValidGameNumber(99)).toBe(true);
    expect(isValidGameNumber(null)).toBe(true);
    expect(isValidGameNumber(undefined)).toBe(true);
  });

  it('отклоняет 0, >99, дробные и NaN', () => {
    expect(isValidGameNumber(0)).toBe(false);
    expect(isValidGameNumber(100)).toBe(false);
    expect(isValidGameNumber(12.5)).toBe(false);
    expect(isValidGameNumber(NaN)).toBe(false);
  });
});

describe('рост/вес', () => {
  it('валидны null и значения в границах', () => {
    expect(isValidHeight(null)).toBe(true);
    expect(isValidHeight(HEIGHT_MIN)).toBe(true);
    expect(isValidHeight(180)).toBe(true);
    expect(isValidHeight(HEIGHT_MAX)).toBe(true);
    expect(isValidWeight(WEIGHT_MIN)).toBe(true);
    expect(isValidWeight(75)).toBe(true);
    expect(isValidWeight(WEIGHT_MAX)).toBe(true);
  });

  it('отклоняет выход за границы, дробные и NaN', () => {
    expect(isValidHeight(HEIGHT_MIN - 1)).toBe(false);
    expect(isValidHeight(HEIGHT_MAX + 1)).toBe(false);
    expect(isValidHeight(180.5)).toBe(false);
    expect(isValidHeight(NaN)).toBe(false);
    expect(isValidWeight(WEIGHT_MIN - 1)).toBe(false);
    expect(isValidWeight(WEIGHT_MAX + 1)).toBe(false);
  });

  it('clamp приводит к границам и округляет, мусор → null', () => {
    expect(clampHeight(5000)).toBe(HEIGHT_MAX);
    expect(clampHeight(10)).toBe(HEIGHT_MIN);
    expect(clampHeight(180.4)).toBe(180);
    expect(clampHeight(NaN)).toBe(null);
    expect(clampHeight(null)).toBe(null);
    expect(clampWeight(9999)).toBe(WEIGHT_MAX);
    expect(clampWeight(1)).toBe(WEIGHT_MIN);
    expect(clampWeight(75.6)).toBe(76);
    expect(clampWeight(NaN)).toBe(null);
  });
});
