import { describe, expect, it } from 'vitest';
import { hasPremium } from '@/lib/access';

const now = new Date('2026-06-18T12:00:00Z');

describe('access — hasPremium', () => {
  it('FREE → нет доступа', () => {
    expect(hasPremium({ accessTier: 'FREE', premiumUntil: null }, now)).toBe(false);
  });

  it('PREMIUM без срока → бессрочный доступ', () => {
    expect(hasPremium({ accessTier: 'PREMIUM', premiumUntil: null }, now)).toBe(true);
  });

  it('PREMIUM со сроком в будущем → доступ', () => {
    expect(hasPremium({ accessTier: 'PREMIUM', premiumUntil: new Date('2026-07-01') }, now)).toBe(true);
    expect(hasPremium({ accessTier: 'PREMIUM', premiumUntil: '2026-07-01T00:00:00Z' }, now)).toBe(true);
  });

  it('PREMIUM с истёкшим сроком → нет доступа', () => {
    expect(hasPremium({ accessTier: 'PREMIUM', premiumUntil: new Date('2026-06-01') }, now)).toBe(false);
  });

  it('пустой/битый ввод → нет доступа', () => {
    expect(hasPremium(null, now)).toBe(false);
    expect(hasPremium(undefined, now)).toBe(false);
    expect(hasPremium({ accessTier: 'PREMIUM', premiumUntil: 'не-дата' }, now)).toBe(false);
  });
});
