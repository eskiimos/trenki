import { describe, expect, it } from 'vitest';
import {
  sanitizeName,
  isValidName,
  sanitizeNumberInput,
  isValidGameNumber,
  NAME_MAX_FIRST,
  NAME_MAX_LAST,
} from '@/lib/profile-validation';

describe('sanitizeName', () => {
  it('оставляет буквы (латиница + кириллица) и дефис', () => {
    expect(sanitizeName('Иван-Петр', NAME_MAX_FIRST)).toBe('Иван-Петр');
    expect(sanitizeName('Anna-Maria', NAME_MAX_LAST)).toBe('Anna-Maria');
  });

  it('вырезает цифры, пробелы и спецсимволы', () => {
    expect(sanitizeName('Ив4ан Пе!тр', NAME_MAX_LAST)).toBe('ИванПетр');
    expect(sanitizeName('O’Brien 99', NAME_MAX_LAST)).toBe('OBrien');
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
  it('принимает валидные имена и пустую строку', () => {
    expect(isValidName('', NAME_MAX_FIRST)).toBe(true);
    expect(isValidName('Иван', NAME_MAX_FIRST)).toBe(true);
    expect(isValidName('Анна-Мария', NAME_MAX_LAST)).toBe(true);
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
