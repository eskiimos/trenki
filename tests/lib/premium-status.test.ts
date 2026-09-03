import { describe, it, expect } from 'vitest';
import { premiumKind, premiumStatus } from '../../src/lib/premium-status';

const now = new Date('2026-09-03T12:00:00Z');
const future = new Date('2026-10-01T00:00:00Z');
const past = new Date('2026-08-01T00:00:00Z');

describe('premiumKind', () => {
  it('оплата важнее пометки: платил → paid даже с триальной пометкой', () => {
    expect(
      premiumKind({ accessTier: 'PREMIUM', premiumUntil: future, premiumNote: 'Пробный период 7 дн.', paidCount: 1 }),
    ).toBe('paid');
  });
  it('пометка «Пробный период…» без оплат → trial', () => {
    expect(
      premiumKind({ accessTier: 'PREMIUM', premiumUntil: future, premiumNote: 'Пробный период 7 дн. по глобальной настройке', paidCount: 0 }),
    ).toBe('trial');
  });
  it('PREMIUM без оплат и без триальной пометки → manual; FREE без оплат → none', () => {
    expect(premiumKind({ accessTier: 'PREMIUM', premiumUntil: null, premiumNote: 'выдал Марк', paidCount: 0 })).toBe('manual');
    expect(premiumKind({ accessTier: 'PREMIUM', premiumUntil: null, premiumNote: null, paidCount: 0 })).toBe('manual');
    expect(premiumKind({ accessTier: 'FREE', premiumUntil: null, premiumNote: null, paidCount: 0 })).toBe('none');
  });
});

describe('premiumStatus', () => {
  it('истёкший триал — НЕ «Премиум» (суть правки владельца)', () => {
    const s = premiumStatus({ accessTier: 'PREMIUM', premiumUntil: past, premiumNote: 'Пробный период 7 дн.', paidCount: 0 }, now);
    expect(s.active).toBe(false);
    expect(s.expired).toBe(true);
    expect(s.label).toBe('Пробный истёк');
  });
  it('действующий триал / оплата / ручная выдача — разные подписи', () => {
    expect(premiumStatus({ accessTier: 'PREMIUM', premiumUntil: future, premiumNote: 'Пробный период 7 дн.', paidCount: 0 }, now).label).toBe('Пробный период');
    expect(premiumStatus({ accessTier: 'PREMIUM', premiumUntil: future, premiumNote: 'T-Bank init x', paidCount: 2 }, now).label).toBe('Премиум');
    expect(premiumStatus({ accessTier: 'PREMIUM', premiumUntil: null, premiumNote: null, paidCount: 0 }, now).label).toBe('Премиум (вручную)');
  });
  it('истёкшая оплата → «Премиум истёк»; FREE после оплат → «Платил раньше»; чистый FREE — без бейджа', () => {
    expect(premiumStatus({ accessTier: 'PREMIUM', premiumUntil: past, premiumNote: null, paidCount: 1 }, now).label).toBe('Премиум истёк');
    expect(premiumStatus({ accessTier: 'FREE', premiumUntil: null, premiumNote: null, paidCount: 1 }, now).label).toBe('Платил раньше');
    expect(premiumStatus({ accessTier: 'FREE', premiumUntil: null, premiumNote: null, paidCount: 0 }, now).label).toBeNull();
  });
});
