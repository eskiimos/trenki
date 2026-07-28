import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { requireAuthUser } from '@/lib/coach/guards';
import { getTbankConfig, initPayment } from '@/lib/payments/tbank';
import { getSubscriptionPricing, getReceiptSettings } from '@/lib/settings';
import { buildReceipt } from '@/lib/payments/receipt';
import { SUBSCRIPTION_PERIOD_DAYS } from '@/lib/payments/grant';
import { logger } from '@/lib/logger';

// POST /api/payments/init — старт оплаты доступа. Оплата РАЗОВАЯ: списание один
// раз, премиум на 30 дней, продление — вручную новой оплатой (автосписания нет).
// Создаёт Payment(NEW), зовёт T-Bank Init, возвращает PaymentURL для редиректа.
// Реальный статус — из вебхука + GetState, а не из редиректа.
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

  // Чек 54-ФЗ. Включается в админке — только когда подключена облачная касса и
  // подтверждена система налогообложения. Пока выключен, платёж идёт без чека
  // (как и раньше), чтобы неверные реквизиты не ломали оплату.
  const receiptSettings = await getReceiptSettings();
  let receipt: Record<string, unknown> | undefined;
  if (receiptSettings.enabled) {
    const built = buildReceipt({
      amountKopecks,
      email: user.email,
      name: `Доступ к сервису «Треньки», ${SUBSCRIPTION_PERIOD_DAYS} дней`,
      taxation: receiptSettings.taxation,
      vat: receiptSettings.vat,
    });
    if (!built) {
      // Чек включён, но собрать его нельзя (нет email у покупателя). Платить без
      // чека нельзя — это нарушение 54-ФЗ, поэтому честно останавливаемся.
      logger.error('receipt build failed', { userId: user.id, hasEmail: Boolean(user.email) });
      return NextResponse.json(
        { error: 'Для оплаты нужен email в профиле — на него придёт чек' },
        { status: 400 },
      );
    }
    receipt = built as unknown as Record<string, unknown>;
  }
  const orderId = `sub_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;
  const origin = returnOrigin();

  // Запись заказа ДО обращения к банку (аудит + идемпотентность по orderId).
  await prisma.payment.create({
    data: { orderId, userId: user.id, amountKopecks, status: 'NEW', kind: 'init', isRecurrentInit: false },
  });

  let res;
  try {
    res = await initPayment(config, {
      amountKopecks,
      orderId,
      description: 'Доступ «Треньки» на 30 дней',
      customerKey: user.id, // стабильный ключ клиента на стороне банка
      // Recurrent НЕ передаём: оплата разовая, автосписания нет. Это ещё и
      // требование тест-кейса №1 T-Bank («не передавайте Recurrent=Y»).
      notificationURL: `${origin}/api/webhook/tbank`,
      successURL: `${origin}/subscription/success?orderId=${orderId}`,
      failURL: `${origin}/subscription/fail?orderId=${orderId}`,
      receipt, // не участвует в подписи Token (см. tbank.ts)
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
