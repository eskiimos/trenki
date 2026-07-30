import { prisma } from '@/lib/prisma';
import { AccessTier } from '@/generated/prisma';

// Выдача/продление премиума после успешной оплаты. Один источник для вебхука
// T-Bank и крона автосписания — те же поля, что ставит ручной админ-грант.

export const SUBSCRIPTION_PERIOD_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Вычисляет новый premiumUntil при добавлении `days` дней. Если премиум ещё
 * активен — дни добавляются к текущему сроку (остаток не сгорает: триал + оплата
 * складываются, а не перезатирают друг друга); иначе отсчёт идёт от now.
 * Чистая функция — вынесена, чтобы протестировать логику стекинга без БД.
 */
export function computePremiumUntil(
  current: { accessTier: string | null; premiumUntil: Date | null } | null,
  days: number,
  now: Date,
): Date {
  const stillActive =
    current?.accessTier === 'PREMIUM' &&
    current.premiumUntil != null &&
    current.premiumUntil.getTime() > now.getTime();
  const base = stillActive ? current!.premiumUntil! : now;
  return new Date(base.getTime() + days * DAY_MS);
}

/**
 * Продлевает премиум на произвольное число дней (оплата, триал, ручная выдача).
 * Ядро для grantPremiumPeriod и выдачи триала по промокоду.
 */
export async function grantPremiumDays(
  userId: string,
  days: number,
  opts: { rebillId?: string | null; note?: string; now?: Date } = {},
): Promise<Date> {
  const now = opts.now ?? new Date();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { premiumUntil: true, accessTier: true },
  });
  const premiumUntil = computePremiumUntil(user, days, now);

  await prisma.user.update({
    where: { id: userId },
    data: {
      accessTier: AccessTier.PREMIUM,
      premiumUntil,
      premiumNote: opts.note ?? 'T-Bank подписка',
      ...(opts.rebillId ? { tbankRebillId: opts.rebillId } : {}),
    },
  });
  return premiumUntil;
}

/**
 * Продлевает премиум на один платёжный период (30 дней). rebillId (если пришёл)
 * сохраняется для последующих автосписаний.
 */
export async function grantPremiumPeriod(
  userId: string,
  opts: { rebillId?: string | null; note?: string; now?: Date } = {},
): Promise<Date> {
  return grantPremiumDays(userId, SUBSCRIPTION_PERIOD_DAYS, opts);
}

/**
 * Идемпотентная выдача премиума ПО ЗАКАЗУ. Атомарно «клеймит» Payment
 * (premiumGrantedAt: null → now через updateMany) и продлевает премиум ровно один
 * раз на orderId — сколько бы раз ни дёрнули (вебхук + ретраи + опрос статуса +
 * гонки). Возвращает granted=false, если премиум по этому заказу уже выдан.
 * rebillId берём из opts или из самой записи Payment (сохранён при Init/нотификации).
 */
export async function grantPremiumForPayment(
  orderId: string,
  opts: { rebillId?: string | null; note?: string; now?: Date } = {},
): Promise<{ granted: boolean; until?: Date }> {
  const now = opts.now ?? new Date();

  // Атомарный клейм: пройдёт только у ОДНОГО вызова (count === 1).
  const claim = await prisma.payment.updateMany({
    where: { orderId, premiumGrantedAt: null },
    data: { premiumGrantedAt: now },
  });
  if (claim.count !== 1) return { granted: false };

  const payment = await prisma.payment.findUnique({
    where: { orderId },
    select: { userId: true, rebillId: true, kind: true },
  });
  if (!payment) return { granted: false };

  const until = await grantPremiumPeriod(payment.userId, {
    rebillId: opts.rebillId ?? payment.rebillId,
    note: opts.note ?? `T-Bank ${payment.kind} ${orderId}`,
    now,
  });
  return { granted: true, until };
}
