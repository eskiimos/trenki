import { describe, it, expect } from 'vitest';
import { computePremiumAfterRefund } from '../../src/lib/payments/grant';
import { FULL_CANCEL_STATUSES } from '../../src/lib/payments/tbank';

const NOW = new Date('2026-09-04T12:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;

describe('computePremiumAfterRefund — откат периода после полного возврата', () => {
  it('единственная оплата: срок уходит в прошлое → доступ снимается (null)', () => {
    const until = new Date(NOW.getTime() + 20 * DAY); // 30 выдали, 10 уже прошло
    expect(computePremiumAfterRefund({ accessTier: 'PREMIUM', premiumUntil: until }, 30, NOW)).toBeNull();
  });

  it('две оплаты: отнимаем ровно один период, остаток живёт', () => {
    const until = new Date(NOW.getTime() + 50 * DAY);
    const next = computePremiumAfterRefund({ accessTier: 'PREMIUM', premiumUntil: until }, 30, NOW);
    expect(next?.getTime()).toBe(until.getTime() - 30 * DAY);
  });

  it('срок ровно now после вычитания — уже не активен → null', () => {
    const until = new Date(NOW.getTime() + 30 * DAY);
    expect(computePremiumAfterRefund({ accessTier: 'PREMIUM', premiumUntil: until }, 30, NOW)).toBeNull();
  });

  it('бессрочный премиум (ручная выдача) возврат НЕ трогает', () => {
    expect(computePremiumAfterRefund({ accessTier: 'PREMIUM', premiumUntil: null }, 30, NOW)).toBeNull();
    // null здесь означает «оставить как есть» — вызывающий проверяет бессрочность отдельно
  });

  it('FREE / null-пользователь → null, ничего не падает', () => {
    expect(computePremiumAfterRefund({ accessTier: 'FREE', premiumUntil: new Date(NOW.getTime() + 5 * DAY) }, 30, NOW)).toBeNull();
    expect(computePremiumAfterRefund(null, 30, NOW)).toBeNull();
  });
});

describe('FULL_CANCEL_STATUSES', () => {
  it('полные отмены — CANCELED/REVERSED/REFUNDED; частичные — нет', () => {
    for (const s of ['CANCELED', 'REVERSED', 'REFUNDED']) expect(FULL_CANCEL_STATUSES.has(s)).toBe(true);
    for (const s of ['PARTIAL_REFUNDED', 'PARTIAL_REVERSED', 'CONFIRMED', 'NEW']) expect(FULL_CANCEL_STATUSES.has(s)).toBe(false);
  });
});
