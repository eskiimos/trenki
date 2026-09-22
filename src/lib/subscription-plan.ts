// Единый источник правды по подписке: ДЕФОЛТЫ цен и списки фич. Фактические цены
// редактируются из админки (AppSetting, см. getSubscriptionPricing в settings.ts) —
// поэтому здесь только дефолты и вычисление интро-цены. Реальная оплата (T-Bank) —
// отдельный трек. Значения/копирайт — из PDF и Figma-макета (2026-07).

export const PRICING_DEFAULTS = {
  priceMonthlyRub: 1200, // базовая цена ₽/мес
  introDiscountPercent: 75, // «до 75%» — макс. скидка по промокоду тренера
  introMonths: 3, // на сколько первых месяцев действует интро-скидка
  priceQuarterRub: 0, // цена за 3 месяца; 0 — тариф не продаётся (ставит админ)
};

export interface SubscriptionPricing {
  priceMonthlyRub: number;
  introDiscountPercent: number;
  introMonths: number;
  introPriceRub: number; // вычисляемая: цена со скидкой (round)
  /** Цена «3 месяца» (разовая оплата за 90 дней), ₽. 0 — не продаётся. */
  priceQuarterRub: number;
}

// ── Тарифы (п.12 «Середина сентября», решения владельца 21.09): месяц и
// квартал. Оба — разовая оплата без автопродления; квартал = 90 дней по своей
// цене, которую ставит админ. Льгота по промокоду (300 ₽) — только помесячно.

export type SubscriptionPlan = 'month' | 'quarter';

/** Срок доступа по тарифу, дней. */
export const PLAN_PERIOD_DAYS: Record<SubscriptionPlan, number> = { month: 30, quarter: 90 };

/** Тариф из тела запроса; всё неизвестное — null (400), пусто — месяц. */
export function parsePlan(v: unknown): SubscriptionPlan | null {
  if (v === undefined || v === null || v === '') return 'month';
  return v === 'month' || v === 'quarter' ? v : null;
}

/** Срок заказа из БД: ожидаем 30 или 90; всё странное — 30 (как до тарифов). */
export function normalizePeriodDays(v: number | null | undefined): number {
  return Number.isInteger(v) && (v as number) >= 1 && (v as number) <= 366 ? (v as number) : PLAN_PERIOD_DAYS.month;
}

/** Сколько «месяцев» (30-дневных периодов) покрывает заказ: 30 → 1, 90 → 3. */
export function periodMonths(periodDays: number): number {
  return Math.max(1, Math.round(normalizePeriodDays(periodDays) / PLAN_PERIOD_DAYS.month));
}

/**
 * Проверка цены квартала из админки. 0 — выключить тариф. Иначе — дороже
 * месяца (иначе заказ квартала выглядел бы как льготный месяц) и не дороже
 * трёх месяцев (иначе тариф бессмысленен — скорее опечатка).
 */
export function validateQuarterPrice(quarterRub: number, monthlyRub: number): string | null {
  if (!Number.isInteger(quarterRub) || quarterRub < 0) return 'Цена за 3 месяца — целое число ₽ (0 — не продавать)';
  if (quarterRub === 0) return null;
  if (quarterRub <= monthlyRub) return 'Цена за 3 месяца должна быть больше цены за месяц';
  if (quarterRub > monthlyRub * 3) return 'Цена за 3 месяца не может быть больше трёх месячных';
  return null;
}

/** Что показать про квартал: цена, «≈ N ₽/мес», выгода против 3 × месяц. */
export function quarterOffer(pricing: Pick<SubscriptionPricing, 'priceMonthlyRub' | 'priceQuarterRub'>): {
  enabled: boolean;
  priceRub: number;
  perMonthRub: number;
  savingsRub: number;
} {
  const priceRub = pricing.priceQuarterRub;
  if (!(priceRub > 0)) return { enabled: false, priceRub: 0, perMonthRub: 0, savingsRub: 0 };
  return {
    enabled: true,
    priceRub,
    perMonthRub: Math.round(priceRub / 3),
    savingsRub: Math.max(0, pricing.priceMonthlyRub * 3 - priceRub),
  };
}

/** Интро-цена ₽/мес после скидки. Напр. 1200 при −75% → 300. */
export function computeIntroPrice(priceMonthlyRub: number, introDiscountPercent: number): number {
  const pct = Math.max(0, Math.min(100, introDiscountPercent));
  return Math.round(priceMonthlyRub * (1 - pct / 100));
}

/**
 * Эффективные условия интро-скидки: у канала свои или глобальные.
 *
 * NULL у промокода = НАСЛЕДОВАТЬ глобальную настройку; 0 = у канала скидки нет
 * вовсе (решение владельца 2026-09-02). Проверка глобальных значений идёт
 * ПОСЛЕ подстановки кодовых — иначе персональная скидка канала не работала бы,
 * пока общая выключена.
 *
 * active=false означает «интро не действует» — платим базовую цену.
 * Чистая функция: тестируется без БД (tests/lib/subscription-plan.test.ts).
 */
export function effectiveIntro(
  code: { discountPercent: number | null; discountMonths: number | null },
  global: { priceMonthlyRub: number; introDiscountPercent: number; introMonths: number },
): { percent: number; months: number; introPriceRub: number; active: boolean } {
  const percent = code.discountPercent ?? global.introDiscountPercent;
  const months = code.discountMonths ?? global.introMonths;
  const introPriceRub = computeIntroPrice(global.priceMonthlyRub, percent);
  // introPriceRub <= 0 (скидка 100%): T-Bank не примет Init на 0 ₽, а чек
  // 54-ФЗ на ноль не собирается — такая конфигурация не действует.
  const active = percent > 0 && months > 0 && introPriceRub > 0;
  return { percent, months, introPriceRub, active };
}

// «Что входит в подписку» — копирайт из Figma-макета.
export const PAID_FEATURES: string[] = [
  'Полный доступ к тренировкам от лучших специалистов',
  'Индивидуальный план тренировок от персонального ИИ-тренера',
  'Удобный календарь тренировок с напоминаниями',
  'Наглядная шкала роста «потенциала» и прогресса',
  'Персональный HOCKEY ID',
  'Новинки каждую неделю',
];

// Бесплатный тариф (решения владельца 2026-07-06).
export const FREE_FEATURES: string[] = [
  'Шортсы',
  'Информация о тренерах',
  '1 тренировка от ИИ-тренера в неделю',
];
