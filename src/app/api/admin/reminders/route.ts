import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAsync } from '@/lib/admin-session';
import { getReminderSettings, setAppSetting, parseHHMM, SETTING_KEYS } from '@/lib/settings';
import { logger } from '@/lib/logger';

// Настройки времени уведомлений (читает/пишет app_settings). Только админ.
// GET  → текущие значения. PATCH → валидирует и сохраняет.
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const denied = await requireAdminAsync(request);
  if (denied) return denied;
  try {
    const s = await getReminderSettings();
    return NextResponse.json({
      dailyTime: s.dailyTime,
      preworkoutEarlyMin: s.preworkoutEarlyMin,
      preworkoutLateMin: s.preworkoutLateMin,
    });
  } catch (error) {
    logger.error('admin/reminders GET failed', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const denied = await requireAdminAsync(request);
  if (denied) return denied;
  try {
    const body = await request.json().catch(() => ({}));
    const dailyTimeRaw = typeof body.dailyTime === 'string' ? body.dailyTime.trim() : '';
    const early = Number(body.preworkoutEarlyMin);
    const late = Number(body.preworkoutLateMin);

    const hm = parseHHMM(dailyTimeRaw);
    if (!hm) {
      return NextResponse.json(
        { error: 'Время ежедневного напоминания — формат ЧЧ:ММ' },
        { status: 400 },
      );
    }
    // Клампим в дневной диапазон: бессмысленно будить ночью, плюс буфер до
    // полуночи (иначе позднее время может «потеряться» при переходе суток).
    const targetMin = hm.hour * 60 + hm.minute;
    if (targetMin < 6 * 60 || targetMin > 22 * 60) {
      return NextResponse.json(
        { error: 'Время ежедневного напоминания — в диапазоне 06:00–22:00' },
        { status: 400 },
      );
    }
    const okInt = (n: number) => Number.isInteger(n) && n >= 1 && n <= 1440;
    if (!okInt(early) || !okInt(late)) {
      return NextResponse.json(
        { error: 'Оффсеты предтренировочных — целые минуты от 1 до 1440' },
        { status: 400 },
      );
    }
    // Зазор ≥ 10 мин: окна напоминаний ±5 мин не должны пересекаться (иначе
    // одна тренировка получит два пуша подряд).
    if (early - late < 10) {
      return NextResponse.json(
        { error: 'Раннее напоминание должно быть минимум на 10 минут раньше позднего' },
        { status: 400 },
      );
    }

    const normTime = `${String(hm.hour).padStart(2, '0')}:${String(hm.minute).padStart(2, '0')}`;
    await setAppSetting(SETTING_KEYS.dailyTime, normTime);
    await setAppSetting(SETTING_KEYS.preworkoutEarlyMin, String(early));
    await setAppSetting(SETTING_KEYS.preworkoutLateMin, String(late));

    const s = await getReminderSettings();
    return NextResponse.json({
      ok: true,
      dailyTime: s.dailyTime,
      preworkoutEarlyMin: s.preworkoutEarlyMin,
      preworkoutLateMin: s.preworkoutLateMin,
    });
  } catch (error) {
    logger.error('admin/reminders PATCH failed', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
