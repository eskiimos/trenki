import { prisma } from '@/lib/prisma';
import { AccessTier } from '@/generated/prisma';

// Выдача/продление премиума после успешной оплаты. Один источник для вебхука
// T-Bank и крона автосписания — те же поля, что ставит ручной админ-грант.

export const SUBSCRIPTION_PERIOD_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Продлевает премиум на один период. Если премиум ещё активен — период
 * добавляется к текущему premiumUntil (остаток не сгорает); иначе — от now.
 * rebillId (если пришёл) сохраняется для последующих автосписаний.
 */
export async function grantPremiumPeriod(
  userId: string,
  opts: { rebillId?: string | null; note?: string; now?: Date } = {},
): Promise<Date> {
  const now = opts.now ?? new Date();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { premiumUntil: true, accessTier: true },
  });
  const stillActive =
    user?.accessTier === 'PREMIUM' && user.premiumUntil != null && user.premiumUntil.getTime() > now.getTime();
  const base = stillActive ? user!.premiumUntil! : now;
  const premiumUntil = new Date(base.getTime() + SUBSCRIPTION_PERIOD_DAYS * DAY_MS);

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
