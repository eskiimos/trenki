import { prisma } from '@/lib/prisma';
import { getSubscriptionPricing } from '@/lib/settings';
import { effectiveIntro } from '@/lib/subscription-plan';

// Персональная цена подписки С УЧЁТОМ ПРОМОКОДА — единый источник и для показа
// (/api/subscription/pricing/me), и для списания (/api/payments/init).
//
// Правило (продуктовое решение 2026-07: 1200 → 300 ₽ на первые 3 мес по
// промокоду тренера): если у пользователя привязан АКТИВНЫЙ ReferralCode и он
// оплатил меньше introMonths периодов — платит интро-цену; дальше — базовую.
// До этого фикса скидка существовала только в маркетинговом тексте: init
// списывал базовую цену со ВСЕХ, включая пришедших по промокоду (жалоба
// владельца «у юзера с промокодом цена стандартная»).

export interface UserPricing {
  /** Сколько списывать/показывать этому юзеру, ₽ за период. */
  amountRub: number;
  /** Действует ли сейчас интро-цена по промокоду. */
  isIntro: boolean;
  /** Сколько оплат по интро-цене осталось (включая текущую), 0 если не действует. */
  introPaymentsLeft: number;
  /** Базовая цена без скидки, ₽. */
  basePriceRub: number;
  /** Интро-цена, ₽ (для зачёркнутого/подписи). */
  introPriceRub: number;
  introMonths: number;
  introDiscountPercent: number;
  /**
   * Только forCharge: интро-слоты заняты НЕЗАВЕРШЁННЫМИ платёжными ссылками —
   * новую по интро-цене создавать нельзя (init отвечает 409, а не молча
   * списывает базовую: показанная цена обязана совпадать со списанной).
   */
  pendingIntroHold?: boolean;
}

/** Живут ли ещё незакрытые платёжные ссылки: RedirectDueDate = 30 мин + запас. */
const PENDING_WINDOW_MS = 35 * 60 * 1000;

/**
 * Цена для юзера userId (ПОЛУЧАТЕЛЯ премиума: при оплате родителем за ребёнка
 * передавать ребёнка — промокод тренера принадлежит атлету).
 *
 * forCharge — режим СПИСАНИЯ (/api/payments/init): дополнительно резервирует
 * интро-слоты под незавершённые платёжные ссылки. Без этого юзер создавал N
 * ссылок подряд (paidCount не растёт до вебхука), у каждой сумма фиксировалась
 * банком по интро-цене, и все N оплачивались по 300 ₽ — неограниченный фарм
 * скидки (находка платёжного ревью).
 */
export async function resolveUserPricing(
  userId: string,
  opts: { forCharge?: boolean } = {},
): Promise<UserPricing> {
  const pricing = await getSubscriptionPricing();
  const base: UserPricing = {
    amountRub: pricing.priceMonthlyRub,
    isIntro: false,
    introPaymentsLeft: 0,
    basePriceRub: pricing.priceMonthlyRub,
    introPriceRub: pricing.introPriceRub,
    introMonths: pricing.introMonths,
    introDiscountPercent: pricing.introDiscountPercent,
  };

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { referralCode: true },
  });
  if (!user?.referralCode) return base;

  // Код должен существовать и быть активным: выключенный админом промокод
  // скидку не даёт (атрибуция канала при этом остаётся).
  const rc = await prisma.referralCode.findFirst({
    where: { code: user.referralCode, isActive: true },
    select: { id: true, discountPercent: true, discountMonths: true },
  });
  if (!rc) return base;

  // Условия скидки: свои у канала, иначе глобальные (чистая логика — в
  // effectiveIntro, покрыта тестами).
  const {
    percent: effPercent,
    months: effMonths,
    introPriceRub: effIntroRub,
    active,
  } = effectiveIntro(rc, pricing);
  if (!active) return base;

  // Эффективные условия отдаём наружу: их показывают модалка и родительский
  // кабинет («вместо 1200 ₽», «осталось N оплат»).
  const effBase: UserPricing = {
    ...base,
    introPriceRub: effIntroRub,
    introMonths: effMonths,
    introDiscountPercent: effPercent,
  };

  // Сколько периодов уже УСПЕШНО оплачено этим получателем: считаем по
  // premiumGrantedAt (атомарный флаг «премиум по этому заказу выдан») — статусы
  // T-Bank разношёрстные, а этот флаг ставится ровно один раз на оплату.
  const paidCount = await prisma.payment.count({
    where: { userId, premiumGrantedAt: { not: null }, isTest: false },
  });
  const slotsLeft = effMonths - paidCount;
  if (slotsLeft <= 0) return effBase;

  if (opts.forCharge) {
    // Незавершённые интро-ссылки (сумма ниже базовой, премиум не выдан, созданы
    // в окне жизни ссылки) занимают слоты. Заняты все — 409, не тихая базовая.
    const pendingIntro = await prisma.payment.count({
      where: {
        userId,
        premiumGrantedAt: null,
        isTest: false,
        amountKopecks: { lt: pricing.priceMonthlyRub * 100 },
        createdAt: { gt: new Date(Date.now() - PENDING_WINDOW_MS) },
      },
    });
    if (pendingIntro >= slotsLeft) {
      return { ...effBase, pendingIntroHold: true };
    }
  }

  return {
    ...effBase,
    amountRub: effIntroRub,
    isIntro: true,
    introPaymentsLeft: slotsLeft,
  };
}
