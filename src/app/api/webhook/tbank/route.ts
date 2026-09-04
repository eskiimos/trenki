import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTbankConfigByTerminalKey, getTbankConfigFor, verifyNotificationToken } from '@/lib/payments/tbank';
import { grantPremiumForPayment, revokePremiumForPayment } from '@/lib/payments/grant';
import { FULL_CANCEL_STATUSES } from '@/lib/payments/tbank';
import { logger } from '@/lib/logger';

// POST /api/webhook/tbank — Notification от T-Bank о статусе платежа.
// Проверяем подпись Token, идемпотентно обновляем Payment; при переходе в
// CONFIRMED — выдаём/продлеваем премиум и сохраняем RebillId (рекуррент).
// ОБЯЗАТЕЛЬНО отвечаем телом "OK", иначе T-Bank будет ретраить.
export const dynamic = 'force-dynamic';

const okText = () => new NextResponse('OK', { status: 200, headers: { 'Content-Type': 'text/plain' } });

export async function POST(request: NextRequest) {
  const payload = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!payload) return NextResponse.json({ error: 'bad body' }, { status: 400 });

  // Кассу выбираем по TerminalKey из самой нотификации: после переключения
  // режима (боевая/тестовая) долетают нотификации от обеих, и проверка паролем
  // «текущей» кассы отбросила бы чужую как подделку.
  const terminalKey = payload.TerminalKey != null ? String(payload.TerminalKey) : null;
  const config = getTbankConfigByTerminalKey(terminalKey);
  if (!config) {
    logger.error('tbank webhook: unknown terminal', { terminalKey });
    return NextResponse.json({ error: 'not configured' }, { status: 500 });
  }

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

  // Касса нотификации обязана совпадать с кассой платежа: иначе нотификация,
  // подписанная паролем ТЕСТОВОГО терминала (он виден в ЛК любому с доступом),
  // могла бы «подтвердить» боевой заказ и выдать премиум бесплатно.
  const expected = getTbankConfigFor(payment.isTest ? 'test' : 'live');
  if (!expected || expected.terminalKey !== config.terminalKey) {
    logger.warn('tbank webhook: terminal mismatch', {
      orderId,
      isTest: payment.isTest,
      terminalKey: config.terminalKey,
    });
    return okText(); // OK — чтобы не ретраили, но ничего не меняем
  }

  // Статус не откатываем назад: нотификации могут прийти не по порядку (ретраи).
  // CONFIRMED — терминальный успех, из него уходим только в возврат (полный или
  // частичный). Полный возврат/отмена — терминальны совсем: заказ «заморожен»,
  // поздний CONFIRMED его не оживит и премиум не выдаст (ревью возвратов).
  const isCancel = FULL_CANCEL_STATUSES.has(status) || status.startsWith('PARTIAL_');
  const keepConfirmed = payment.status === 'CONFIRMED' && !isCancel;
  const written = await prisma.payment.updateMany({
    // Условие в самом UPDATE (а не по прочитанной строке): между findUnique и
    // update мог пройти Cancel из админки.
    where: { orderId, refundedAt: null, status: { notIn: [...FULL_CANCEL_STATUSES] } },
    data: {
      status: keepConfirmed ? payment.status : status || payment.status,
      paymentId: paymentId ?? payment.paymentId,
      rebillId: rebillId ?? payment.rebillId,
      errorCode,
      raw: payload as object,
    },
  });
  if (written.count === 0) {
    logger.info('tbank webhook: order already refunded, ignored', { orderId, status });
    return okText();
  }

  // Сохранённую карту фиксируем на юзере СРАЗУ (не только внутри гранта) — иначе
  // при гонке «опрос статуса выдал премиум раньше вебхука» RebillId бы потерялся,
  // и рекуррент молча не запустился бы.
  if (rebillId) {
    await prisma.user
      .update({ where: { id: payment.userId }, data: { tbankRebillId: rebillId } })
      .catch((e) => logger.warn('tbank webhook: rebill save failed', { orderId, err: String(e) }));
  }

  // Выдача премиума ИДЕМПОТЕНТНА по orderId (атомарный клейм внутри) — вебхук,
  // его ретраи и опрос статуса вместе выдадут ровно один период.
  if (status === 'CONFIRMED') {
    try {
      const r = await grantPremiumForPayment(orderId, { rebillId, note: `T-Bank ${payment.kind} ${orderId}` });
      if (r.granted) {
        logger.info('tbank webhook: premium granted', {
          userId: payment.userId,
          orderId,
          until: r.until?.toISOString(),
          rebillSaved: Boolean(rebillId),
        });
      }
    } catch (e) {
      logger.error('tbank webhook: grant failed', e);
      // Не отвечаем OK — пусть T-Bank повторит, чтобы не потерять выдачу.
      return NextResponse.json({ error: 'grant failed' }, { status: 500 });
    }
  }

  // Полный возврат/отмена — в т.ч. сделанные из кабинета банка, минуя нашу
  // админку: откатываем выданный период (идемпотентно по orderId). Частичный
  // возврат (PARTIAL_*) премиум не трогает — решение владельца не принималось,
  // просто фиксируем статус.
  if (FULL_CANCEL_STATUSES.has(status)) {
    try {
      const amount = payload.Amount != null ? Number(payload.Amount) : null;
      const r = await revokePremiumForPayment(orderId, {
        amountKopecks: Number.isFinite(amount) ? amount : null,
        note: `Возврат ${orderId} (${status}, нотификация T-Bank)`,
      });
      if (r.revoked) {
        logger.info('tbank webhook: premium revoked', {
          userId: payment.userId,
          orderId,
          status,
          until: r.until?.toISOString() ?? null,
        });
      }
    } catch (e) {
      logger.error('tbank webhook: revoke failed', e);
      return NextResponse.json({ error: 'revoke failed' }, { status: 500 });
    }
  }

  return okText();
}
