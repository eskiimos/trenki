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

/**
 * Срок премиума ПОСЛЕ полного возврата одного периода в `days` дней: отнимаем
 * период от текущего срока; если после этого срок уже в прошлом (или премиума
 * не было) — доступ снимается (null → вызывающий ставит FREE). Бессрочный
 * премиум (premiumUntil=null при PREMIUM — ручная выдача) возврат не трогает:
 * он не был куплен. Чистая функция — тесты без БД.
 */
export function computePremiumAfterRefund(
  current: { accessTier: string | null; premiumUntil: Date | null } | null,
  days: number,
  now: Date,
): Date | null {
  if (!current || current.accessTier !== 'PREMIUM') return null;
  if (current.premiumUntil == null) return current.premiumUntil; // бессрочный — не трогаем
  const next = new Date(current.premiumUntil.getTime() - days * DAY_MS);
  return next.getTime() > now.getTime() ? next : null;
}

/**
 * Идемпотентный откат премиума ПО ЗАКАЗУ после полного возврата/отмены.
 * Атомарно «клеймит» Payment (refundedAt: null → now) — сколько бы раз ни
 * дёрнули (Cancel из админки + REFUNDED-нотификация + её ретраи), период
 * отнимется ровно один раз. Если премиум по заказу не выдавался (отмена
 * неоплаченного) — отнимать нечего, только помечаем.
 */
export async function revokePremiumForPayment(
  orderId: string,
  opts: { amountKopecks?: number | null; note?: string; now?: Date } = {},
): Promise<{ revoked: boolean; until: Date | null }> {
  const now = opts.now ?? new Date();
  const claim = await prisma.payment.updateMany({
    where: { orderId, refundedAt: null },
    data: { refundedAt: now, ...(opts.amountKopecks != null ? { refundAmountKopecks: opts.amountKopecks } : {}) },
  });
  if (claim.count !== 1) return { revoked: false, until: null };

  const payment = await prisma.payment.findUnique({
    where: { orderId },
    select: { userId: true, premiumGrantedAt: true },
  });
  if (!payment || !payment.premiumGrantedAt) return { revoked: false, until: null };

  const user = await prisma.user.findUnique({
    where: { id: payment.userId },
    select: { accessTier: true, premiumUntil: true },
  });
  const until = computePremiumAfterRefund(user, SUBSCRIPTION_PERIOD_DAYS, now);
  const bessrochny = user?.accessTier === 'PREMIUM' && user.premiumUntil == null;
  await prisma.user.update({
    where: { id: payment.userId },
    data: bessrochny
      ? { premiumNote: opts.note ?? `Возврат ${orderId} (бессрочный премиум не тронут)` }
      : until
        ? { premiumUntil: until, premiumNote: opts.note ?? `Возврат ${orderId}` }
        : { accessTier: AccessTier.FREE, premiumUntil: null, premiumNote: opts.note ?? `Возврат ${orderId}` },
  });
  return { revoked: true, until };
}
