import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTbankConfig, verifyNotificationToken } from '@/lib/payments/tbank';
import { grantPremiumPeriod } from '@/lib/payments/grant';
import { logger } from '@/lib/logger';

// POST /api/webhook/tbank — Notification от T-Bank о статусе платежа.
// Проверяем подпись Token, идемпотентно обновляем Payment; при переходе в
// CONFIRMED — выдаём/продлеваем премиум и сохраняем RebillId (рекуррент).
// ОБЯЗАТЕЛЬНО отвечаем телом "OK", иначе T-Bank будет ретраить.
export const dynamic = 'force-dynamic';

const okText = () => new NextResponse('OK', { status: 200, headers: { 'Content-Type': 'text/plain' } });

export async function POST(request: NextRequest) {
  const config = getTbankConfig();
  if (!config) {
    logger.error('tbank webhook: config missing');
    return NextResponse.json({ error: 'not configured' }, { status: 500 });
  }

  const payload = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!payload) return NextResponse.json({ error: 'bad body' }, { status: 400 });

  // Подпись обязательна — иначе это не от банка.
  if (!verifyNotificationToken(config, payload)) {
    logger.warn('tbank webhook: bad token', { orderId: payload.OrderId });
    return NextResponse.json({ error: 'bad token' }, { status: 403 });
  }

  const orderId = payload.OrderId != null ? String(payload.OrderId) : '';
  const status = payload.Status != null ? String(payload.Status) : '';
  const paymentId = payload.PaymentId != null ? String(payload.PaymentId) : null;
  const rebillId = payload.RebillId != null ? String(payload.RebillId) : null;
  const errorCode = payload.ErrorCode != null ? String(payload.ErrorCode) : null;

  const payment = orderId ? await prisma.payment.findUnique({ where: { orderId } }) : null;
  if (!payment) {
    // Неизвестный заказ — отвечаем OK, чтобы банк не ретраил бесконечно.
    logger.warn('tbank webhook: unknown order', { orderId, status });
    return okText();
  }

  // Идемпотентность: выдаём премиум ТОЛЬКО при первом переходе в CONFIRMED.
  const alreadyConfirmed = payment.status === 'CONFIRMED';
  const nowConfirmed = status === 'CONFIRMED';

  await prisma.payment.update({
    where: { orderId },
    data: {
      status: status || payment.status,
      paymentId: paymentId ?? payment.paymentId,
      rebillId: rebillId ?? payment.rebillId,
      errorCode,
      raw: payload as object,
    },
  });

  if (nowConfirmed && !alreadyConfirmed) {
    try {
      const until = await grantPremiumPeriod(payment.userId, {
        rebillId,
        note: `T-Bank ${payment.kind} ${orderId}`,
      });
      logger.info('tbank webhook: premium granted', {
        userId: payment.userId,
        orderId,
        until: until.toISOString(),
        rebillSaved: Boolean(rebillId),
      });
    } catch (e) {
      logger.error('tbank webhook: grant failed', e);
      // Не отвечаем OK — пусть T-Bank повторит, чтобы не потерять выдачу.
      return NextResponse.json({ error: 'grant failed' }, { status: 500 });
    }
  }

  return okText();
}
