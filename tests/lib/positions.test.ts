import { describe, it, expect } from 'vitest';
import {
  POSITION_OPTIONS, POSITION_SHORT, POSITION_LABEL, positionShort, positionLabel,
} from '../../src/lib/positions';

describe('positions', () => {
  it('сокращения из правки владельца: ЦН, ЛН, ПН, ПЗ, ЛЗ, ВР', () => {
    expect(POSITION_OPTIONS.map((p) => POSITION_SHORT[p]).sort()).toEqual(
      ['ВР', 'ЛЗ', 'ЛН', 'ПЗ', 'ПН', 'ЦН'].sort(),
    );
  });

  it('устаревшее общее DEFENSEMAN не в пикере, но отображается как «З»', () => {
    expect(POSITION_OPTIONS).not.toContain('DEFENSEMAN');
    expect(positionShort('DEFENSEMAN')).toBe('З');
    expect(positionLabel('DEFENSEMAN')).toBe('Защитник');
  });

  it('пусто / мусор → null, у каждого варианта есть полное название', () => {
    expect(positionShort(null)).toBeNull();
    expect(positionShort('')).toBeNull();
    expect(positionShort('WINGER')).toBeNull();
    for (const p of POSITION_OPTIONS) expect(POSITION_LABEL[p].length).toBeGreaterThan(3);
  });
});
