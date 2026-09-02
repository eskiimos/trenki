import { describe, it, expect } from 'vitest';
import { computeIntroPrice, effectiveIntro, PRICING_DEFAULTS } from '../../src/lib/subscription-plan';

// Глобальные настройки прода на момент правки: 1200 ₽, −75%, 3 месяца → 300 ₽
const GLOBAL = { priceMonthlyRub: 1200, introDiscountPercent: 75, introMonths: 3 };
const NO_CODE_SETTINGS = { discountPercent: null, discountMonths: null };

describe('computeIntroPrice', () => {
  it('75% от 1200 → 300', () => {
    expect(computeIntroPrice(1200, 75)).toBe(300);
  });
  it('0% → базовая цена', () => {
    expect(computeIntroPrice(1200, 0)).toBe(1200);
  });
  it('процент клампится в 0..100', () => {
    expect(computeIntroPrice(1000, -50)).toBe(1000);
    expect(computeIntroPrice(1000, 150)).toBe(0);
  });
  it('дефолты проекта дают 300 ₽', () => {
    expect(
      computeIntroPrice(PRICING_DEFAULTS.priceMonthlyRub, PRICING_DEFAULTS.introDiscountPercent),
    ).toBe(300);
  });
});

describe('effectiveIntro — условия скидки канала vs глобальные', () => {
  it('NULL у кода → наследует глобальные', () => {
    const r = effectiveIntro(NO_CODE_SETTINGS, GLOBAL);
    expect(r).toEqual({ percent: 75, months: 3, introPriceRub: 300, active: true });
  });

  it('свой процент канала перебивает глобальный', () => {
    const r = effectiveIntro({ discountPercent: 50, discountMonths: null }, GLOBAL);
    expect(r.percent).toBe(50);
    expect(r.introPriceRub).toBe(600);
    expect(r.months).toBe(3); // месяцы унаследованы
    expect(r.active).toBe(true);
  });

  it('свой период канала перебивает глобальный', () => {
    const r = effectiveIntro({ discountPercent: null, discountMonths: 12 }, GLOBAL);
    expect(r.months).toBe(12);
    expect(r.percent).toBe(75);
  });

  it('0% у канала = скидки нет, даже когда глобальная включена', () => {
    const r = effectiveIntro({ discountPercent: 0, discountMonths: null }, GLOBAL);
    expect(r.active).toBe(false);
  });

  it('0 месяцев у канала = скидки нет', () => {
    const r = effectiveIntro({ discountPercent: null, discountMonths: 0 }, GLOBAL);
    expect(r.active).toBe(false);
  });

  it('КЛЮЧЕВОЕ: скидка канала работает при ВЫКЛЮЧЕННОЙ глобальной', () => {
    // Ради этого переставлен порядок проверок в resolveUserPricing: раньше
    // ранний return на глобальном 0% отсекал скидку до чтения промокода.
    const globalOff = { priceMonthlyRub: 1200, introDiscountPercent: 0, introMonths: 0 };
    const r = effectiveIntro({ discountPercent: 40, discountMonths: 2 }, globalOff);
    expect(r).toEqual({ percent: 40, months: 2, introPriceRub: 720, active: true });
  });

  it('100% скидка не действует: Init на 0 ₽ невозможен', () => {
    const r = effectiveIntro({ discountPercent: 100, discountMonths: 3 }, GLOBAL);
    expect(r.introPriceRub).toBe(0);
    expect(r.active).toBe(false);
  });

  it('глобальная выключена и у кода ничего своего → скидки нет', () => {
    const globalOff = { priceMonthlyRub: 1200, introDiscountPercent: 0, introMonths: 3 };
    expect(effectiveIntro(NO_CODE_SETTINGS, globalOff).active).toBe(false);
  });
});
