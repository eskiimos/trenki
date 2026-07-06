import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAsync } from '@/lib/admin-session';
import { getPaywallMode, setAppSetting, SETTING_KEYS } from '@/lib/settings';
import { PAYWALL_MODES, normalizePaywallMode } from '@/lib/paywall';
import { logger } from '@/lib/logger';

// Роллаут-контроль paywall (читает/пишет app_settings, ключ paywall.mode). Только админ.
// GET → текущий режим. PATCH → валидирует и сохраняет ('off' | 'admins' | 'on').
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const denied = await requireAdminAsync(request);
  if (denied) return denied;
  try {
    const mode = await getPaywallMode();
    return NextResponse.json({ mode, modes: PAYWALL_MODES });
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
    const raw = typeof body.mode === 'string' ? body.mode : '';
    if (!PAYWALL_MODES.includes(raw as never)) {
      return NextResponse.json({ error: 'mode: off | admins | on' }, { status: 400 });
    }
    const mode = normalizePaywallMode(raw);
    await setAppSetting(SETTING_KEYS.paywallMode, mode);
    logger.info('admin set paywall mode', { mode });
    return NextResponse.json({ mode });
  } catch (error) {
    logger.error('admin/paywall PATCH failed', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
