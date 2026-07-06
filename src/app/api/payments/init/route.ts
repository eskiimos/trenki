import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { requireAuthUser } from '@/lib/coach/guards';
import { getTbankConfig, initPayment } from '@/lib/payments/tbank';
import { getSubscriptionPricing } from '@/lib/settings';
import { logger } from '@/lib/logger';

// POST /api/payments/init — старт оформления подписки (рекуррент).
// Создаёт Payment(NEW), зовёт T-Bank Init с Recurrent=Y и CustomerKey=user.id,
// возвращает PaymentURL для редиректа. Реальный статус — из вебхука + GetState.
export const dynamic = 'force-dynamic';

function returnOrigin(): string {
  return (process.env.TBANK_RETURN_ORIGIN || 'https://trenki.app').replace(/\/+$/, '');
}

export async function POST(request: NextRequest) {
  const auth = await requireAuthUser(request);
  if ('response' in auth) return auth.response;
  const user = auth.user;

  const config = getTbankConfig();
  if (!config) {
    return NextResponse.json({ error: 'Оплата пока не настроена' }, { status: 503 });
  }

  const pricing = await getSubscriptionPricing();
  const amountKopecks = pricing.priceMonthlyRub * 100;
  const orderId = `sub_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;
  const origin = returnOrigin();

  // Запись заказа ДО обращения к банку (аудит + идемпотентность по orderId).
  await prisma.payment.create({
    data: { orderId, userId: user.id, amountKopecks, status: 'NEW', kind: 'init', isRecurrentInit: true },
  });

  let res;
  try {
    res = await initPayment(config, {
      amountKopecks,
      orderId,
      description: 'Подписка «Треньки» (1 месяц)',
      customerKey: user.id, // стабильный ключ клиента для рекуррента
      recurrent: true,
      notificationURL: `${origin}/api/webhook/tbank`,
      successURL: `${origin}/subscription/success?orderId=${orderId}`,
      failURL: `${origin}/subscription/fail?orderId=${orderId}`,
    });
  } catch (e) {
    logger.error('tbank Init failed', e);
    await prisma.payment.update({ where: { orderId }, data: { status: 'REJECTED', errorCode: 'INIT_ERROR' } });
    return NextResponse.json({ error: 'Не удалось создать платёж' }, { status: 502 });
  }

  if (!res.Success || !res.PaymentURL) {
    logger.error('tbank Init rejected', { orderId, errorCode: res.ErrorCode, message: res.Message });
    await prisma.payment.update({
      where: { orderId },
      data: { status: 'REJECTED', errorCode: res.ErrorCode ?? null, paymentId: res.PaymentId ?? null },
    });
    return NextResponse.json({ error: res.Message || 'Банк отклонил платёж' }, { status: 502 });
  }

  await prisma.payment.update({
    where: { orderId },
    data: { paymentId: res.PaymentId ?? null, status: res.Status ?? 'NEW' },
  });

  logger.info('tbank Init ok', { orderId, paymentId: res.PaymentId });
  return NextResponse.json({ paymentURL: res.PaymentURL, orderId });
}
