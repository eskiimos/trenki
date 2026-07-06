import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAsync } from '@/lib/admin-session';
import { getPaywallMode, getSubscriptionPricing, setAppSetting, SETTING_KEYS } from '@/lib/settings';
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
    const [mode, pricing] = await Promise.all([getPaywallMode(), getSubscriptionPricing()]);
    return NextResponse.json({ mode, modes: PAYWALL_MODES, pricing });
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
      if (!okInt(introDiscountPercent, 0, 100)) {
        return NextResponse.json({ error: 'Скидка — целое от 0 до 100 (%)' }, { status: 400 });
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

    return NextResponse.json({ error: 'Нужен mode или pricing' }, { status: 400 });
  } catch (error) {
    logger.error('admin/paywall PATCH failed', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
