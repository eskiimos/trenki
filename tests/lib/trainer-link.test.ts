import { describe, it, expect } from 'vitest';
import { trainerProfileHref } from '@/lib/trainer-link';

describe('trainerProfileHref', () => {
  it('ведёт на страницу тренера по id', () => {
    expect(trainerProfileHref({ id: 'cmf1abc' })).toBe('/trainers/cmf1abc');
  });

  it('нет тренера или id (старый ответ API) → null, карточка ведёт на видео', () => {
    expect(trainerProfileHref(null)).toBeNull();
    expect(trainerProfileHref(undefined)).toBeNull();
    expect(trainerProfileHref({})).toBeNull();
    expect(trainerProfileHref({ id: null })).toBeNull();
    expect(trainerProfileHref({ id: '  ' })).toBeNull();
  });

  it('экранирует id в пути', () => {
    expect(trainerProfileHref({ id: 'a/b?c' })).toBe('/trainers/a%2Fb%3Fc');
  });
});
