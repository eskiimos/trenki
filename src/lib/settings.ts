import { prisma } from '@/lib/prisma';
import { normalizePaywallMode, type PaywallMode } from '@/lib/paywall';

/**
 * Настройки приложения (таблица app_settings, key-value). Сейчас — время
 * уведомлений, редактируемое из админки (/admin/reminders). Крон-роуты читают
 * значения отсюда вместо зашитых констант. value хранится строкой; парсинг,
 * валидация и дефолты — здесь.
 */

export const SETTING_KEYS = {
  dailyTime: 'reminder.dailyTime', // "HH:MM" — ежедневное напоминание (локально по TZ юзера)
  preworkoutEarlyMin: 'reminder.preworkoutEarlyMin', // минут до тренировки — раннее
  preworkoutLateMin: 'reminder.preworkoutLateMin', // минут до тренировки — позднее
  paywallMode: 'paywall.mode', // 'off' | 'admins' | 'on' — роллаут-контроль paywall
} as const;

export const REMINDER_DEFAULTS = {
  dailyTime: '10:00',
  preworkoutEarlyMin: 30,
  preworkoutLateMin: 10,
};

export interface ReminderSettings {
  dailyHour: number; // 0..23
  dailyMinute: number; // 0..59
  dailyTime: string; // нормализованное "HH:MM"
  preworkoutEarlyMin: number; // > preworkoutLateMin
  preworkoutLateMin: number;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Парс "HH:MM" с валидацией. null, если формат/диапазон неверный. */
export function parseHHMM(s: string): { hour: number; minute: number } | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec((s || '').trim());
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute };
}

/** Целое в диапазоне [1, 1440] или дефолт. */
export function parseMinutes(v: string | undefined, def: number): number {
  const n = Number(v);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1 || n > 1440) return def;
  return n;
}

/**
 * Читает настройки времени уведомлений. Если таблицы ещё нет (до миграции) или
 * значения битые — отдаёт дефолты, чтобы крон не падал.
 */
export async function getReminderSettings(): Promise<ReminderSettings> {
  let rows: { key: string; value: string }[] = [];
  try {
    rows = await prisma.appSetting.findMany({
      where: {
        key: {
          in: [SETTING_KEYS.dailyTime, SETTING_KEYS.preworkoutEarlyMin, SETTING_KEYS.preworkoutLateMin],
        },
      },
      select: { key: true, value: true },
    });
  } catch {
    // таблицы может не быть до применения миграции — отдаём дефолты
  }
  const map = new Map(rows.map((r) => [r.key, r.value]));

  const hm =
    parseHHMM(map.get(SETTING_KEYS.dailyTime) ?? REMINDER_DEFAULTS.dailyTime) ??
    parseHHMM(REMINDER_DEFAULTS.dailyTime)!;
  const early = parseMinutes(map.get(SETTING_KEYS.preworkoutEarlyMin), REMINDER_DEFAULTS.preworkoutEarlyMin);
  const late = parseMinutes(map.get(SETTING_KEYS.preworkoutLateMin), REMINDER_DEFAULTS.preworkoutLateMin);

  return {
    dailyHour: hm.hour,
    dailyMinute: hm.minute,
    dailyTime: `${pad(hm.hour)}:${pad(hm.minute)}`,
    preworkoutEarlyMin: early,
    preworkoutLateMin: late,
  };
}

/** Upsert одного значения настройки. */
export async function setAppSetting(key: string, value: string): Promise<void> {
  await prisma.appSetting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}

/**
 * Текущий режим paywall (роллаут-контроль). Дефолт 'off', если значение не задано,
 * битое или таблицы ещё нет (до миграции) — чтобы paywall по умолчанию был выключен.
 */
export async function getPaywallMode(): Promise<PaywallMode> {
  try {
    const row = await prisma.appSetting.findUnique({
      where: { key: SETTING_KEYS.paywallMode },
      select: { value: true },
    });
    return normalizePaywallMode(row?.value);
  } catch {
    return normalizePaywallMode(undefined); // таблицы может не быть — 'off'
  }
}
