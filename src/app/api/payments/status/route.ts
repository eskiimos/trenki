import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuthUser } from '@/lib/coach/guards';
import { getTbankConfig, getState } from '@/lib/payments/tbank';
import { grantPremiumForPayment } from '@/lib/payments/grant';
import { hasPremium } from '@/lib/access';
import { logger } from '@/lib/logger';

// GET /api/payments/status?orderId=... — статус платежа для страницы ожидания.
// Основной источник выдачи премиума — вебхук; здесь подстраховываемся GetState
// (если нотификация задержалась), выдаём премиум идемпотентно при CONFIRMED.
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await requireAuthUser(request);
  if ('response' in auth) return auth.response;

  const orderId = request.nextUrl.searchParams.get('orderId') ?? '';
  if (!orderId) return NextResponse.json({ error: 'orderId required' }, { status: 400 });

  const payment = await prisma.payment.findUnique({ where: { orderId } });
  // Доступ только к своему заказу (не доверяем orderId из query для чужого юзера)
  // ЛИБО к заказу привязанного ребёнка — родитель оплачивает подписку ребёнка
  // из кабинета и ждёт подтверждения на той же success-странице.
  if (!payment) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (payment.userId !== auth.user.id) {
    const link = await prisma.parentLink.findUnique({
      where: { parentId_childId: { parentId: auth.user.id, childId: payment.userId } },
      select: { id: true },
    });
    if (!link) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  let status = payment.status;

  // Подстраховка: если ещё не CONFIRMED — спросим банк напрямую.
  const config = getTbankConfig();
  if (config && payment.paymentId && status !== 'CONFIRMED' && status !== 'REJECTED' && status !== 'REFUNDED') {
    try {
      const st = await getState(config, payment.paymentId);
      if (st.Success && st.Status) {
        status = st.Status;
        await prisma.payment.update({ where: { orderId }, data: { status } });
        // Идемпотентно по orderId: даже если вебхук уже выдал — второй раз не выдаст.
        if (status === 'CONFIRMED') {
          await grantPremiumForPayment(orderId, { note: `T-Bank ${payment.kind} ${orderId}` });
        }
      }
    } catch (e) {
      logger.warn('payments/status GetState failed', { err: String(e) });
    }
  }

  // Премиум ПОЛУЧАТЕЛЯ платежа (при самооплате это сам auth-юзер, при оплате
  // родителем — ребёнок; его статус родитель и так видит в /api/parent/children).
  const fresh = await prisma.user.findUnique({
    where: { id: payment.userId },
    select: { accessTier: true, premiumUntil: true },
  });

  return NextResponse.json({
    status,
    paid: status === 'CONFIRMED',
    hasPremium: hasPremium(fresh),
    premiumUntil: fresh?.premiumUntil ?? null,
  });
}
