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
