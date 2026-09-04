import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAsync } from '@/lib/admin-session';
import {
  getPaywallMode,
  getSubscriptionPricing,
  getFreeLessonVideoId,
  getReceiptSettings,
  getGlobalTrialDays,
  getPaymentsMode,
  setAppSetting,
  SETTING_KEYS,
} from '@/lib/settings';
import { TAXATION_VALUES, VAT_VALUES } from '@/lib/payments/receipt';
import { PAYMENTS_MODES, normalizePaymentsMode, tbankModesStatus } from '@/lib/payments/tbank';
import { prisma } from '@/lib/prisma';
import { PAYWALL_MODES, normalizePaywallMode } from '@/lib/paywall';
import { logger } from '@/lib/logger';

// Настройки подписки: режим paywall (paywall.mode) + цены (subscription.*).
// Читает/пишет app_settings. Только админ.
// GET   → { mode, modes, pricing }.
// PATCH → { mode } ЛИБО { pricing: { priceMonthlyRub, introDiscountPercent, introMonths } }.
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const denied = await requireAdminAsync(request);
  if (denied) return denied;
  try {
    const [mode, pricing, freeLessonVideoId, receipt, trialDays, paymentsMode] = await Promise.all([
      getPaywallMode(),
      getSubscriptionPricing(),
      getFreeLessonVideoId(),
      getReceiptSettings(),
      getGlobalTrialDays(),
      getPaymentsMode(),
    ]);
    // Название текущего бесплатного занятия — чтобы админ видел, что выбрано.
    const freeLesson = freeLessonVideoId
      ? await prisma.video.findUnique({
          where: { id: freeLessonVideoId },
          select: { id: true, title: true, isPublished: true },
        })
      : null;
    return NextResponse.json({
      mode,
      modes: PAYWALL_MODES,
      pricing,
      freeLesson,
      receipt,
      receiptOptions: { taxations: TAXATION_VALUES, vats: VAT_VALUES },
      trialDays,
      // Касса: текущий режим + какие терминалы заданы в env (паролей тут нет)
      payments: { mode: paymentsMode, modes: PAYMENTS_MODES, terminals: tbankModesStatus() },
    });
  } catch (error) {
    logger.error('admin/paywall GET failed', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const denied = await requireAdminAsync(request);
  if (denied) return denied;
  try {
    const body = await request.json().catch(() => ({}));

    // Ветка 1: смена режима paywall.
    if (typeof body.mode === 'string') {
      if (!PAYWALL_MODES.includes(body.mode as never)) {
        return NextResponse.json({ error: 'mode: off | admins | on' }, { status: 400 });
      }
      const mode = normalizePaywallMode(body.mode);
      await setAppSetting(SETTING_KEYS.paywallMode, mode);
      logger.info('admin set paywall mode', { mode });
      return NextResponse.json({ mode });
    }

    // Ветка 2: цены.
    if (body.pricing && typeof body.pricing === 'object') {
      const p = body.pricing;
      const priceMonthlyRub = Number(p.priceMonthlyRub);
      const introDiscountPercent = Number(p.introDiscountPercent);
      const introMonths = Number(p.introMonths);

      const okInt = (n: number, min: number, max: number) =>
        Number.isInteger(n) && n >= min && n <= max;
      if (!okInt(priceMonthlyRub, 1, 1_000_000)) {
        return NextResponse.json({ error: 'Цена ₽/мес — целое от 1 до 1 000 000' }, { status: 400 });
      }
      // Максимум 99: скидка 100% давала бы Init на 0 копеек — T-Bank такой
      // платёж отклоняет, а чек 54-ФЗ на ноль не собирается.
      if (!okInt(introDiscountPercent, 0, 99)) {
        return NextResponse.json({ error: 'Скидка — целое от 0 до 99 (%)' }, { status: 400 });
      }
      if (!okInt(introMonths, 0, 36)) {
        return NextResponse.json({ error: 'Месяцев интро — целое от 0 до 36' }, { status: 400 });
      }

      await Promise.all([
        setAppSetting(SETTING_KEYS.priceMonthly, String(priceMonthlyRub)),
        setAppSetting(SETTING_KEYS.introDiscountPercent, String(introDiscountPercent)),
        setAppSetting(SETTING_KEYS.introMonths, String(introMonths)),
      ]);
      const pricing = await getSubscriptionPricing();
      logger.info('admin set subscription pricing', { pricing });
      return NextResponse.json({ pricing });
    }

    // Ветка 3: «бесплатное занятие недели». Пустая строка — снять.
    if (typeof body.freeLessonVideoId === 'string') {
      const id = body.freeLessonVideoId.trim();
      if (id) {
        const video = await prisma.video.findUnique({ where: { id }, select: { id: true, title: true, isPublished: true } });
        if (!video) {
          return NextResponse.json({ error: 'Видео с таким id не найдено' }, { status: 400 });
        }
        await setAppSetting(SETTING_KEYS.freeLessonVideoId, video.id);
        logger.info('admin set free lesson', { videoId: video.id });
        return NextResponse.json({ freeLesson: video });
      }
      await setAppSetting(SETTING_KEYS.freeLessonVideoId, '');
      logger.info('admin cleared free lesson');
      return NextResponse.json({ freeLesson: null });
    }

    // Ветка 4: чек 54-ФЗ.
    if (body.receipt && typeof body.receipt === 'object') {
      const r = body.receipt;
      const enabled = Boolean(r.enabled);
      const taxation = String(r.taxation ?? '');
      const vat = String(r.vat ?? '');
      if (!TAXATION_VALUES.includes(taxation as never)) {
        return NextResponse.json({ error: 'Некорректная система налогообложения' }, { status: 400 });
      }
      if (!VAT_VALUES.includes(vat as never)) {
        return NextResponse.json({ error: 'Некорректная ставка НДС' }, { status: 400 });
      }
      await Promise.all([
        setAppSetting(SETTING_KEYS.receiptEnabled, enabled ? '1' : '0'),
        setAppSetting(SETTING_KEYS.receiptTaxation, taxation),
        setAppSetting(SETTING_KEYS.receiptVat, vat),
      ]);
      logger.info('admin set receipt settings', { enabled, taxation, vat });
      return NextResponse.json({ receipt: await getReceiptSettings() });
    }

    // Ветка 5: пробный период для ВСЕХ новых пользователей, дней (0 = выключен).
    if (body.trialDays !== undefined) {
      const days = Number(body.trialDays);
      if (!Number.isInteger(days) || days < 0 || days > 365) {
        return NextResponse.json({ error: 'Пробный период — целое от 0 до 365 дней' }, { status: 400 });
      }
      await setAppSetting(SETTING_KEYS.trialDays, String(days));
      logger.info('admin set global trial', { days });
      return NextResponse.json({ trialDays: days });
    }

    // Ветка 6: касса — боевая или тестовая.
    if (typeof body.paymentsMode === 'string') {
      const next = normalizePaymentsMode(body.paymentsMode);
      if (!PAYMENTS_MODES.includes(body.paymentsMode as never)) {
        return NextResponse.json({ error: 'paymentsMode: live | test' }, { status: 400 });
      }
      // Переключаться некуда, если ключи этой кассы не заданы в env: иначе
      // оплата молча начнёт отдавать 503.
      const terminals = tbankModesStatus();
      if (!terminals[next].configured) {
        return NextResponse.json(
          {
            error:
              next === 'test'
                ? 'Тестовая касса не настроена: добавь TBANK_TEST_TERMINAL_KEY и TBANK_TEST_PASSWORD в .env.production и перезапусти приложение'
                : 'Боевая касса не настроена: проверь TBANK_TERMINAL_KEY и TBANK_PASSWORD',
          },
          { status: 400 },
        );
      }
      await setAppSetting(SETTING_KEYS.paymentsMode, next);
      logger.warn('admin switched payments mode', { mode: next, terminalKey: terminals[next].terminalKey });
      return NextResponse.json({ payments: { mode: next, modes: PAYMENTS_MODES, terminals } });
    }

    return NextResponse.json({ error: 'Нужен mode, pricing, freeLessonVideoId, receipt, trialDays или paymentsMode' }, { status: 400 });
  } catch (error) {
    logger.error('admin/paywall PATCH failed', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
