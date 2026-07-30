import { describe, it, expect } from 'vitest';
import { computePremiumUntil } from '../../src/lib/payments/grant';

const NOW = new Date('2026-07-30T12:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;

describe('computePremiumUntil — стекинг премиума', () => {
  it('новый пользователь (FREE, срока нет): отсчёт от now', () => {
    const until = computePremiumUntil({ accessTier: 'FREE', premiumUntil: null }, 7, NOW);
    expect(until.getTime()).toBe(NOW.getTime() + 7 * DAY);
  });

  it('null-пользователь трактуется как без премиума', () => {
    const until = computePremiumUntil(null, 30, NOW);
    expect(until.getTime()).toBe(NOW.getTime() + 30 * DAY);
  });

  it('КРИТИЧНО: активный премиум продлевается, остаток НЕ сгорает', () => {
    const active = new Date(NOW.getTime() + 10 * DAY);
    const until = computePremiumUntil({ accessTier: 'PREMIUM', premiumUntil: active }, 30, NOW);
    // 10 оставшихся дней + 30 новых, а не 30 от now
    expect(until.getTime()).toBe(active.getTime() + 30 * DAY);
  });

  it('истёкший премиум: отсчёт от now, а не от старого срока', () => {
    const expired = new Date(NOW.getTime() - 5 * DAY);
    const until = computePremiumUntil({ accessTier: 'PREMIUM', premiumUntil: expired }, 30, NOW);
    expect(until.getTime()).toBe(NOW.getTime() + 30 * DAY);
  });

  it('tier=FREE со стоящим premiumUntil в будущем НЕ считается активным', () => {
    // Защитная ветка: активность требует именно PREMIUM, а не только дату.
    const future = new Date(NOW.getTime() + 10 * DAY);
    const until = computePremiumUntil({ accessTier: 'FREE', premiumUntil: future }, 7, NOW);
    expect(until.getTime()).toBe(NOW.getTime() + 7 * DAY);
  });

  it('триал 7 дней у нового = ровно неделя доступа', () => {
    const until = computePremiumUntil({ accessTier: 'FREE', premiumUntil: null }, 7, NOW);
    expect(Math.round((until.getTime() - NOW.getTime()) / DAY)).toBe(7);
  });
});
