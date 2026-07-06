/**
 * Cron: автосписание подписки по сохранённой карте (рекуррент, Трек B).
 *
 *   0 3 * * * curl -s -H "Authorization: Bearer $CRON_SECRET" \
 *     http://localhost:3000/api/cron/subscription-charge
 *
 * Берёт PREMIUM-юзеров с сохранённым tbankRebillId, у кого premiumUntil на исходе
 * (<= now + RENEW_BEFORE_DAYS), и списывает следующий период через chargeByRebill.
 * Премиум продлевает ВЕБХУК при CONFIRMED (как у первичного платежа) — здесь только
 * инициируем списание и пишем Payment(kind='charge'). Защита от повторных списаний:
 * пропускаем юзера, если у него есть свежая (< GUARD_HOURS) charge-попытка не в REJECTED.
 *
 * ТЕСТ рекуррента без ожидания: ?userId=<id> с тем же Bearer — списать конкретного
 * юзера сейчас (игнорируя окно).
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { getTbankConfig, chargeByRebill } from '@/lib/payments/tbank';
import { getSubscriptionPricing } from '@/lib/settings';
import { AccessTier } from '@/generated/prisma';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const DAY_MS = 24 * 60 * 60 * 1000;
const RENEW_BEFORE_DAYS = 1; // списываем за день до конца
const GUARD_HOURS = 6; // не повторяем списание чаще, чем раз в 6ч

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return NextResponse.json({ error: 'Cron is not configured' }, { status: 500 });
  if (request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const config = getTbankConfig();
  if (!config) return NextResponse.json({ error: 'payments not configured' }, { status: 503 });

  const now = new Date();
  const forceUserId = request.nextUrl.searchParams.get('userId');

  const candidates = forceUserId
    ? await prisma.user.findMany({
        where: { id: forceUserId, tbankRebillId: { not: null } },
        select: { id: true, tbankRebillId: true },
      })
    : await prisma.user.findMany({
        where: {
          accessTier: AccessTier.PREMIUM,
          tbankRebillId: { not: null },
          premiumUntil: { not: null, lte: new Date(now.getTime() + RENEW_BEFORE_DAYS * DAY_MS) },
        },
        select: { id: true, tbankRebillId: true },
      });

  const pricing = await getSubscriptionPricing();
  const amountKopecks = pricing.priceMonthlyRub * 100;

  let charged = 0;
  let skipped = 0;
  let failed = 0;
  for (const u of candidates) {
    if (!u.tbankRebillId) continue;

    // Защита от двойного списания: свежая charge-попытка не в REJECTED.
    const recent = await prisma.payment.findFirst({
      where: {
        userId: u.id,
        kind: 'charge',
        status: { not: 'REJECTED' },
        createdAt: { gte: new Date(now.getTime() - GUARD_HOURS * 60 * 60 * 1000) },
      },
      select: { id: true },
    });
    if (recent && !forceUserId) { skipped++; continue; }

    const orderId = `chg_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;
    await prisma.payment.create({
      data: { orderId, userId: u.id, amountKopecks, status: 'NEW', kind: 'charge', rebillId: u.tbankRebillId },
    });

    try {
      const { init, charge } = await chargeByRebill(config, {
        orderId,
        amountKopecks,
        rebillId: u.tbankRebillId,
        description: 'Продление подписки «Треньки»',
      });
      const status = charge?.Status ?? init.Status ?? (init.Success ? 'NEW' : 'REJECTED');
      await prisma.payment.update({
        where: { orderId },
        data: { status, paymentId: init.PaymentId ?? null, errorCode: charge?.ErrorCode ?? init.ErrorCode ?? null },
      });
      // Премиум продлит вебхук при CONFIRMED. Если банк сразу вернул CONFIRMED —
      // тоже ок, вебхук отработает идемпотентно.
      if (init.Success && (charge?.Success ?? false)) charged++;
      else failed++;
    } catch (e) {
      logger.error('subscription-charge failed', { userId: u.id, orderId, e });
      await prisma.payment.update({ where: { orderId }, data: { status: 'REJECTED', errorCode: 'CHARGE_ERROR' } }).catch(() => {});
      failed++;
    }
  }

  return NextResponse.json({ candidates: candidates.length, charged, skipped, failed });
}
