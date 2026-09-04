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
 * возврата прикладывается по флагу чеков ЭТОЙ кассы (те же позиции, что в
 * Init — полный возврат). После успеха откатываем выданный период премиума
 * (идемпотентно: если REFUNDED-нотификация банка придёт раньше/позже — второй
 * раз не отнимет).
 */
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, ctx: { params: Promise<{ orderId: string }> }) {
  const denied = await requireAdminAsync(request);
  if (denied) return denied;
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
  if (!['NEW', 'AUTHORIZED', 'CONFIRMED', 'FORM_SHOWED'].includes(payment.status)) {
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

  // Чек возврата — по флагу чеков той же кассы. Без email чек не собрать:
  // при включённых чеках честно останавливаемся (как в Init).
  const receiptSettings = await getReceiptSettings(mode);
  let receipt: Record<string, unknown> | undefined;
  if (receiptSettings.enabled && payment.status !== 'NEW') {
    const built = buildReceipt({
      amountKopecks: payment.amountKopecks,
      email: payment.user.email,
      name: `Доступ к сервису «Треньки», ${SUBSCRIPTION_PERIOD_DAYS} дней`,
      taxation: receiptSettings.taxation,
      vat: receiptSettings.vat,
    });
    if (!built) {
      return NextResponse.json(
        { error: 'Чеки включены, но у покупателя нет email — чек возврата не собрать' },
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

  const newStatus = res.Status || 'REFUNDED';
  const refunded = res.OriginalAmount != null && res.NewAmount != null
    ? res.OriginalAmount - res.NewAmount
    : payment.amountKopecks;
  await prisma.payment.update({
    where: { orderId },
    data: { status: newStatus, raw: res as object },
  });

  let revoke = { revoked: false, until: null as Date | null };
  if (FULL_CANCEL_STATUSES.has(newStatus)) {
    revoke = await revokePremiumForPayment(orderId, {
      amountKopecks: refunded,
      note: `Возврат ${orderId} из админки (${newStatus})`,
    });
  }

  return NextResponse.json({
    ok: true,
    status: newStatus,
    refundedKopecks: refunded,
    premiumRevoked: revoke.revoked,
    premiumUntil: revoke.until,
  });
}
