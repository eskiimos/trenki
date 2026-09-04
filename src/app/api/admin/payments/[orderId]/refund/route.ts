import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminAsync } from '@/lib/admin-session';
import { cancelPayment, getTbankConfigFor, FULL_CANCEL_STATUSES } from '@/lib/payments/tbank';
import { revokePremiumForPayment, SUBSCRIPTION_PERIOD_DAYS } from '@/lib/payments/grant';
import { buildReceipt } from '@/lib/payments/receipt';
import { getReceiptSettings } from '@/lib/settings';
import { logger } from '@/lib/logger';

/**
 * POST /api/admin/payments/[orderId]/refund — полный возврат/отмена платежа
 * через T-Bank Cancel (тест-кейсы банка 3 и 8 + реальные возвраты).
 *
 * Касса — та, через которую платёж создавался (isTest), а не текущая. Чек
 * возврата прикладывается по флагу чеков ЭТОЙ кассы и только когда деньги
 * реально двигались (AUTHORIZED/CONFIRMED); уходит ПЛАТЕЛЬЩИКУ (payerId — при
 * оплате родителем это родитель, а не ребёнок-получатель премиума). После
 * успеха откатываем выданный период (идемпотентно: REFUNDED-нотификация банка
 * второй раз не отнимет).
 */
export const dynamic = 'force-dynamic';

/** Денежный POST из админки: Origin (если браузер его прислал) обязан совпадать с хостом. */
function sameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return true; // не-браузерные клиенты Origin не шлют; их держит админ-сессия
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || '';
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ orderId: string }> }) {
  const denied = await requireAdminAsync(request);
  if (denied) return denied;
  if (!sameOrigin(request)) {
    return NextResponse.json({ error: 'Cross-origin запрос отклонён' }, { status: 403 });
  }
  const { orderId } = await ctx.params;

  const payment = await prisma.payment.findUnique({
    where: { orderId },
    include: { user: { select: { id: true, email: true } } },
  });
  if (!payment) return NextResponse.json({ error: 'Платёж не найден' }, { status: 404 });
  if (!payment.paymentId) {
    return NextResponse.json({ error: 'У платежа нет PaymentId банка — отменять нечего' }, { status: 400 });
  }
  if (payment.refundedAt || FULL_CANCEL_STATUSES.has(payment.status)) {
    return NextResponse.json({ error: 'Платёж уже возвращён/отменён' }, { status: 409 });
  }
  const moneyMoved = payment.status === 'AUTHORIZED' || payment.status === 'CONFIRMED';
  if (!moneyMoved && payment.status !== 'NEW' && payment.status !== 'FORM_SHOWED') {
    return NextResponse.json(
      { error: `Статус ${payment.status} не допускает возврат` },
      { status: 400 },
    );
  }

  const mode = payment.isTest ? 'test' : 'live';
  const config = getTbankConfigFor(mode);
  if (!config) {
    return NextResponse.json({ error: `Касса ${mode} не настроена в env` }, { status: 503 });
  }

  // Чек возврата — по флагу чеков той же кассы, только если деньги двигались.
  // Email — плательщика (payerId), фолбэк на получателя для старых заказов.
  const receiptSettings = await getReceiptSettings(mode);
  let receipt: Record<string, unknown> | undefined;
  if (receiptSettings.enabled && moneyMoved) {
    const payer = payment.payerId
      ? await prisma.user.findUnique({ where: { id: payment.payerId }, select: { email: true } })
      : null;
    const built = buildReceipt({
      amountKopecks: payment.amountKopecks,
      email: payer?.email ?? payment.user.email,
      name: `Доступ к сервису «Треньки», ${SUBSCRIPTION_PERIOD_DAYS} дней`,
      taxation: receiptSettings.taxation,
      vat: receiptSettings.vat,
    });
    if (!built) {
      return NextResponse.json(
        { error: 'Чеки включены, но у плательщика нет email — чек возврата не собрать' },
        { status: 400 },
      );
    }
    receipt = built as unknown as Record<string, unknown>;
  }

  let res;
  try {
    res = await cancelPayment(config, { paymentId: payment.paymentId, receipt });
  } catch (e) {
    logger.error('tbank Cancel failed', e);
    return NextResponse.json({ error: 'Банк не ответил на отмену' }, { status: 502 });
  }
  logger.info('tbank Cancel', {
    orderId,
    mode,
    success: res.Success,
    status: res.Status,
    errorCode: res.ErrorCode,
    receipt: Boolean(receipt),
  });
  if (!res.Success) {
    return NextResponse.json(
      { error: `Банк отклонил возврат: ${res.Message || res.ErrorCode}${res.Details ? ` — ${res.Details}` : ''}` },
      { status: 400 },
    );
  }

  const newStatus = res.Status || (moneyMoved ? 'REFUNDED' : 'CANCELED');
  // Отмена неоплаченного — деньги не двигались, сумма возврата 0
  const refunded =
    newStatus === 'CANCELED'
      ? 0
      : res.OriginalAmount != null && res.NewAmount != null
        ? res.OriginalAmount - res.NewAmount
        : payment.amountKopecks;
  // raw не трогаем: там последняя нотификация банка, и REFUNDED-нотификация
  // по этому же возврату придёт сама
  await prisma.payment.updateMany({
    where: { orderId, refundedAt: null },
    data: { status: newStatus },
  });

  let revoke: Awaited<ReturnType<typeof revokePremiumForPayment>> = { revoked: false, until: null };
  if (FULL_CANCEL_STATUSES.has(newStatus)) {
    revoke = await revokePremiumForPayment(orderId, {
      amountKopecks: refunded,
      note: `Возврат ${orderId} из админки (${newStatus})`,
    });
  }

  return NextResponse.json({
    ok: true,
    status: newStatus,
    cancelled: newStatus === 'CANCELED',
    refundedKopecks: refunded,
    premiumRevoked: revoke.revoked,
    premiumUnlimitedKept: Boolean(revoke.unlimitedKept),
    premiumUntil: revoke.until,
  });
}
