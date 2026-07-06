// Единый источник правды по подписке: ДЕФОЛТЫ цен и списки фич. Фактические цены
// редактируются из админки (AppSetting, см. getSubscriptionPricing в settings.ts) —
// поэтому здесь только дефолты и вычисление интро-цены. Реальная оплата (T-Bank) —
// отдельный трек. Значения/копирайт — из PDF и Figma-макета (2026-07).

export const PRICING_DEFAULTS = {
  priceMonthlyRub: 1200, // базовая цена ₽/мес
  introDiscountPercent: 75, // «до 75%» — макс. скидка по промокоду тренера
  introMonths: 3, // на сколько первых месяцев действует интро-скидка
};

export interface SubscriptionPricing {
  priceMonthlyRub: number;
  introDiscountPercent: number;
  introMonths: number;
  introPriceRub: number; // вычисляемая: цена со скидкой (round)
}

/** Интро-цена ₽/мес после скидки. Напр. 1200 при −75% → 300. */
export function computeIntroPrice(priceMonthlyRub: number, introDiscountPercent: number): number {
  const pct = Math.max(0, Math.min(100, introDiscountPercent));
  return Math.round(priceMonthlyRub * (1 - pct / 100));
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
