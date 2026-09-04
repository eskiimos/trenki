import { prisma } from '@/lib/prisma';
import { AccessTier, type Prisma } from '@/generated/prisma';
import { FULL_CANCEL_STATUSES } from '@/lib/payments/tbank';

// Выдача/продление премиума после успешной оплаты и откат после возврата.
// Один источник для вебхука T-Bank, опроса статуса, крона и админки — те же
// поля, что ставит ручной админ-грант.

export const SUBSCRIPTION_PERIOD_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

type Db = Prisma.TransactionClient | typeof prisma;

/**
 * Вычисляет новый premiumUntil при добавлении `days` дней. Если премиум ещё
 * активен — дни добавляются к текущему сроку (остаток не сгорает: триал + оплата
 * складываются, а не перезатирают друг друга); иначе отсчёт идёт от now.
 * БЕССРОЧНЫЙ премиум (PREMIUM + premiumUntil=null, ручная выдача) оплата не
 * укорачивает — возвращаем null, «оставить бессрочным» (ревью возвратов:
 * раньше оплата превращала бессрочный в 30 дней, а возврат затем снимал его).
 * Чистая функция — тесты без БД.
 */
export function computePremiumUntil(
  current: { accessTier: string | null; premiumUntil: Date | null } | null,
  days: number,
  now: Date,
): Date | null {
  if (current?.accessTier === 'PREMIUM' && current.premiumUntil == null) return null;
  const stillActive =
    current?.accessTier === 'PREMIUM' &&
    current.premiumUntil != null &&
    current.premiumUntil.getTime() > now.getTime();
  const base = stillActive ? current!.premiumUntil! : now;
  return new Date(base.getTime() + days * DAY_MS);
}

/**
 * Продлевает премиум на произвольное число дней (оплата, триал, ручная выдача).
 * Ядро для grantPremiumPeriod и выдачи триала по промокоду. null — премиум
 * бессрочный, срок не менялся.
 */
export async function grantPremiumDays(
  userId: string,
  days: number,
  opts: { rebillId?: string | null; note?: string; now?: Date; db?: Db } = {},
): Promise<Date | null> {
  const db = opts.db ?? prisma;
  const now = opts.now ?? new Date();
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { premiumUntil: true, accessTier: true },
  });
  const premiumUntil = computePremiumUntil(user, days, now);

  await db.user.update({
    where: { id: userId },
    data: {
      accessTier: AccessTier.PREMIUM,
      premiumUntil, // null = бессрочный остаётся бессрочным
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
  opts: { rebillId?: string | null; note?: string; now?: Date; db?: Db } = {},
): Promise<Date | null> {
  return grantPremiumDays(userId, SUBSCRIPTION_PERIOD_DAYS, opts);
}

/** Условие «по заказу ещё можно выдать»: не выдавали, не возвращали, не отменён. */
const grantableWhere = () => ({
  premiumGrantedAt: null,
  refundedAt: null,
  status: { notIn: [...FULL_CANCEL_STATUSES] },
});

/**
 * Идемпотентная выдача премиума ПО ЗАКАЗУ. Атомарно «клеймит» Payment
 * (premiumGrantedAt: null → now через updateMany) и продлевает премиум ровно один
 * раз на orderId — сколько бы раз ни дёрнули (вебхук + ретраи + опрос статуса +
 * гонки). Клейм и запись юзера — в одной транзакции: сбой после клейма не
 * оставит заказ «выданным» без премиума. Заказ, по которому уже прошёл
 * возврат/отмена (refundedAt или статус отмены), выдачу НЕ получает — CONFIRMED
 * может прилететь позже REFUNDED (ретраи, порядок нотификаций, гонка с Cancel).
 */
export async function grantPremiumForPayment(
  orderId: string,
  opts: { rebillId?: string | null; note?: string; now?: Date } = {},
): Promise<{ granted: boolean; until?: Date | null }> {
  const now = opts.now ?? new Date();
  return prisma.$transaction(async (tx) => {
    const claim = await tx.payment.updateMany({
      where: { orderId, ...grantableWhere() },
      data: { premiumGrantedAt: now },
    });
    if (claim.count !== 1) return { granted: false };

    const payment = await tx.payment.findUnique({
      where: { orderId },
      select: { userId: true, rebillId: true, kind: true },
    });
    if (!payment) return { granted: false };

    const until = await grantPremiumPeriod(payment.userId, {
      rebillId: opts.rebillId ?? payment.rebillId,
      note: opts.note ?? `T-Bank ${payment.kind} ${orderId}`,
      now,
      db: tx,
    });
    return { granted: true, until };
  });
}

/**
 * Срок премиума ПОСЛЕ полного возврата одного периода в `days` дней: отнимаем
 * период от текущего срока; если после этого срок уже в прошлом (или премиума
 * не было) — доступ снимается (null → вызывающий ставит FREE). Бессрочный
 * премиум (premiumUntil=null при PREMIUM — ручная выдача) возврат не трогает:
 * он не был куплен — вызывающий проверяет это отдельно. Чистая функция.
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

export interface RevokeResult {
  /** Период реально отнят (или доступ снят). */
  revoked: boolean;
  until: Date | null;
  /** Заказ помечен возвращённым, но премиум бессрочный — не тронут. */
  unlimitedKept?: boolean;
}

/**
 * Идемпотентный откат премиума ПО ЗАКАЗУ после полного возврата/отмены.
 * Атомарно «клеймит» Payment (refundedAt: null → now) — сколько бы раз ни
 * дёрнули (Cancel из админки + REFUNDED-нотификация + её ретраи), период
 * отнимется ровно один раз. Клейм и запись юзера — в одной транзакции. Если
 * премиум по заказу не выдавался (отмена неоплаченного) — отнимать нечего,
 * только помечаем.
 */
export async function revokePremiumForPayment(
  orderId: string,
  opts: { amountKopecks?: number | null; note?: string; now?: Date } = {},
): Promise<RevokeResult> {
  const now = opts.now ?? new Date();
  return prisma.$transaction(async (tx) => {
    const claim = await tx.payment.updateMany({
      where: { orderId, refundedAt: null },
      data: {
        refundedAt: now,
        ...(opts.amountKopecks != null ? { refundAmountKopecks: opts.amountKopecks } : {}),
      },
    });
    if (claim.count !== 1) return { revoked: false, until: null };

    const payment = await tx.payment.findUnique({
      where: { orderId },
      select: { userId: true, premiumGrantedAt: true },
    });
    if (!payment || !payment.premiumGrantedAt) return { revoked: false, until: null };

    const user = await tx.user.findUnique({
      where: { id: payment.userId },
      select: { accessTier: true, premiumUntil: true },
    });
    const unlimited = user?.accessTier === 'PREMIUM' && user.premiumUntil == null;
    if (unlimited) {
      await tx.user.update({
        where: { id: payment.userId },
        data: { premiumNote: opts.note ?? `Возврат ${orderId} (бессрочный премиум не тронут)` },
      });
      return { revoked: false, until: null, unlimitedKept: true };
    }

    const until = computePremiumAfterRefund(user, SUBSCRIPTION_PERIOD_DAYS, now);
    await tx.user.update({
      where: { id: payment.userId },
      data: until
        ? { premiumUntil: until, premiumNote: opts.note ?? `Возврат ${orderId}` }
        : { accessTier: AccessTier.FREE, premiumUntil: null, premiumNote: opts.note ?? `Возврат ${orderId}` },
    });
    return { revoked: true, until };
  });
}
