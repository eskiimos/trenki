import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { requireAuthUser } from '@/lib/coach/guards';
import { getTbankConfigFor, initPayment } from '@/lib/payments/tbank';
import { getPaymentsMode, getReceiptSettings } from '@/lib/settings';
import { resolveUserPricing } from '@/lib/payments/user-pricing';
import { buildReceipt } from '@/lib/payments/receipt';
import { SUBSCRIPTION_PERIOD_DAYS } from '@/lib/payments/grant';
import { rateLimit } from '@/lib/coach/rate-limit';
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

  // Родитель может оплатить подписку СВОЕГО ребёнка: Payment.userId = childId,
  // премиум через существующий вебхук уйдёт ребёнку (grant.ts выдаёт по
  // payment.userId). Платит и получает чек (54-ФЗ) текущий юзер — родитель.
  // Без childId (body может отсутствовать вовсе) — самооплата, как раньше.
  const body = (await request.json().catch(() => null)) as { childId?: unknown } | null;
  const childId =
    body && typeof body.childId === 'string' && body.childId ? body.childId : null;
  let childName: string | null = null;
  if (childId) {
    const link = await prisma.parentLink.findUnique({
      where: { parentId_childId: { parentId: user.id, childId } },
      select: { child: { select: { firstName: true, lastName: true } } },
    });
    if (!link) {
      return NextResponse.json(
        { error: 'Можно оплачивать только своих привязанных детей' },
        { status: 403 },
      );
    }
    childName = [link.child.firstName, link.child.lastName].filter(Boolean).join(' ') || null;
  }

  // Какая касса принимает оплату — переключается в админке (правка владельца).
  const paymentsMode = await getPaymentsMode();
  const config = getTbankConfigFor(paymentsMode);
  if (!config) {
    logger.error('tbank config missing', { paymentsMode });
    return NextResponse.json({ error: 'Оплата пока не настроена' }, { status: 503 });
  }
  if (paymentsMode === 'test') {
    // Видно в логах, что деньги не настоящие
    logger.warn('payment init in TEST mode', { userId: user.id, terminalKey: config.terminalKey });
  }

  // Гигиена: массовое создание платёжных ссылок — единственный способ фармить
  // интро-цену, режем на корню.
  if (!rateLimit(`pay-init:${user.id}`, 10, 10 * 60 * 1000).ok) {
    return NextResponse.json({ error: 'Слишком много попыток. Подожди пару минут.' }, { status: 429 });
  }

  // Цена — ПЕРСОНАЛЬНАЯ для получателя премиума (промокод тренера принадлежит
  // атлету: при оплате родителем скидка считается по ребёнку). Раньше здесь
  // всегда списывалась базовая цена — скидка по промокоду существовала только
  // в тексте модалки. forCharge резервирует интро-слоты под незавершённые
  // ссылки (антифарм).
  const userPricing = await resolveUserPricing(childId ?? user.id, { forCharge: true });
  if (userPricing.pendingIntroHold) {
    // НЕ списываем молча базовую вместо показанной интро — показанная цена
    // обязана совпадать со списанной.
    return NextResponse.json(
      { error: 'Предыдущая ссылка на оплату ещё активна. Открой её или попробуй через полчаса.' },
      { status: 409 },
    );
  }
  const amountKopecks = userPricing.amountRub * 100;

  // Чек 54-ФЗ. Включается в админке — только когда подключена облачная касса и
  // подтверждена система налогообложения. Пока выключен, платёж идёт без чека
  // (как и раньше), чтобы неверные реквизиты не ломали оплату.
  const receiptSettings = await getReceiptSettings(paymentsMode);
  let receipt: Record<string, unknown> | undefined;
  if (receiptSettings.enabled) {
    const built = buildReceipt({
      amountKopecks,
      email: user.email, // чек всегда ПЛАТЕЛЬЩИКУ — при оплате за ребёнка тоже

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
  // userId — ПОЛУЧАТЕЛЬ премиума: сам плательщик или его ребёнок (childId).
  await prisma.payment.create({
    data: {
      orderId,
      userId: childId ?? user.id,
      amountKopecks,
      status: 'NEW',
      kind: 'init',
      isRecurrentInit: false,
      isTest: paymentsMode === 'test',
      payerId: user.id, // чек продажи ушёл плательщику — чек возврата уйдёт ему же
    },
  });

  // Родителя после оплаты возвращаем в родительский кабинет (back=parent).
  const backParam = childId ? '&back=parent' : '';

  let res;
  try {
    res = await initPayment(config, {
      amountKopecks,
      orderId,
      description: childName
        ? `Доступ «Треньки» на 30 дней — для ${childName}`
        : 'Доступ «Треньки» на 30 дней',
      customerKey: user.id, // стабильный ключ клиента на стороне банка (плательщик, не ребёнок)
      // Recurrent НЕ передаём: оплата разовая, автосписания нет. Это ещё и
      // требование тест-кейса №1 T-Bank («не передавайте Recurrent=Y»).
      notificationURL: `${origin}/api/webhook/tbank`,
      successURL: `${origin}/subscription/success?orderId=${orderId}${backParam}`,
      failURL: `${origin}/subscription/fail?orderId=${orderId}${backParam}`,
      receipt, // не участвует в подписи Token (см. tbank.ts)
      // Ссылка живёт 30 минут (дефолт банка — сутки): протухшие ссылки не
      // держат интро-слоты и не дают копить оплаты по старой цене.
      redirectDueDate: new Date(Date.now() + 30 * 60 * 1000)
        .toISOString()
        .replace(/\.\d{3}Z$/, '+00:00'),
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

  // Состав чека в лог (без PII): чтобы при разборе тест-кейсов T-Bank было
  // видно, ушёл ли Receipt и с какими реквизитами, а не гадать по коду.
  logger.info('tbank Init ok', {
    orderId,
    paymentId: res.PaymentId,
    mode: paymentsMode,
    receipt: receipt
      ? {
          attached: true,
          taxation: receiptSettings.taxation,
          vat: receiptSettings.vat,
          items: Array.isArray((receipt as { Items?: unknown[] }).Items)
            ? (receipt as { Items: unknown[] }).Items.length
            : 0,
          hasEmail: Boolean((receipt as { Email?: string }).Email),
        }
      : { attached: false, reason: receiptSettings.enabled ? 'build-failed' : 'disabled' },
  });
  return NextResponse.json({ paymentURL: res.PaymentURL, orderId });
}
