/**
 * Cron: автосписание подписки по сохранённой карте (рекуррент, Трек B).
 *
 *   0 3 * * * curl -s -H "Authorization: Bearer $CRON_SECRET" \
 *     http://localhost:3000/api/cron/subscription-charge
 *
 * Берёт PREMIUM-юзеров с сохранённым tbankRebillId, у кого premiumUntil на исходе
 * (<= now + RENEW_BEFORE_DAYS), и списывает следующий период через chargeByRebill.
 * Charge синхронный: при CONFIRMED премиум продлевается ЗДЕСЬ же, идемпотентно по
 * orderId (grantPremiumForPayment); вебхук по тому же orderId выдачу не задвоит.
 * Защита от повторных списаний: пропускаем юзера со свежей (< GUARD_HOURS) charge-
 * попыткой не в REJECTED (окно > суток покрывает суточный крон).
 *
 * ТЕСТ рекуррента без ожидания: ?userId=<id>&force=1 с тем же Bearer — списать
 * конкретного юзера сейчас (снимает окно premiumUntil и guard). force=1 обязателен,
 * иначе guard заблокирует повтор.
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { getTbankConfig, chargeByRebill, getReturnOrigin } from '@/lib/payments/tbank';
import { grantPremiumForPayment } from '@/lib/payments/grant';
import { getSubscriptionPricing } from '@/lib/settings';
import { AccessTier } from '@/generated/prisma';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const DAY_MS = 24 * 60 * 60 * 1000;
const RENEW_BEFORE_DAYS = 1; // списываем за день до конца
const GUARD_HOURS = 25; // > суточного крона: одна charge-попытка на юзера в сутки

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
  // ?force=1 — списать даже при свежей попытке (только для ручного теста рекуррента).
  const force = request.nextUrl.searchParams.get('force') === '1';
  const notificationURL = `${getReturnOrigin()}/api/webhook/tbank`;

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
    if (recent && !force) { skipped++; continue; }

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
        notificationURL,
      });
      const status = charge?.Status ?? init.Status ?? (init.Success ? 'NEW' : 'REJECTED');
      await prisma.payment.update({
        where: { orderId },
        data: { status, paymentId: init.PaymentId ?? null, errorCode: charge?.ErrorCode ?? init.ErrorCode ?? null },
      });
      // Charge — СИНХРОННЫЙ: при CONFIRMED продлеваем премиум ЗДЕСЬ же (идемпотентно
      // по orderId), не полагаясь только на вебхук. Иначе premiumUntil не двигался бы
      // и юзера списывало бы каждый день. Вебхук по этому же orderId вернёт granted=false.
      if (status === 'CONFIRMED') {
        await grantPremiumForPayment(orderId, { rebillId: u.tbankRebillId, note: `T-Bank charge ${orderId}` });
        charged++;
      } else if (init.Success && (charge?.Success ?? false)) {
        charged++;
      } else {
        failed++;
      }
    } catch (e) {
      logger.error('subscription-charge failed', { userId: u.id, orderId, e });
      // НЕ помечаем REJECTED вслепую: при таймауте деньги могли уйти. Оставляем
      // статус NEW (попадёт под guard — повторно за сутки не спишем) + errorCode.
      await prisma.payment.update({ where: { orderId }, data: { errorCode: 'CHARGE_ERROR' } }).catch(() => {});
      failed++;
    }
  }

  return NextResponse.json({ candidates: candidates.length, charged, skipped, failed });
}
