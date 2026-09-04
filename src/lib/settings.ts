import { prisma } from '@/lib/prisma';
import { normalizePaywallMode, type PaywallMode } from '@/lib/paywall';
import {
  PRICING_DEFAULTS,
  computeIntroPrice,
  type SubscriptionPricing,
} from '@/lib/subscription-plan';
import { normalizeTaxation, normalizeVat, type Taxation, type Vat } from '@/lib/payments/receipt';
import { normalizePaymentsMode, type PaymentsMode } from '@/lib/payments/tbank';

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
  freeLessonVideoId: 'freeLesson.videoId', // «бесплатное занятие недели» — id видео, открытого всем
  receiptEnabled: 'receipt.enabled', // формировать ли чек 54-ФЗ ('1'/'0')
  receiptTaxation: 'receipt.taxation', // система налогообложения (osn/usn_income/...)
  receiptVat: 'receipt.vat', // ставка НДС в позиции чека (none/vat20/...)
  priceMonthly: 'subscription.priceMonthlyRub', // базовая цена подписки ₽/мес
  introDiscountPercent: 'subscription.introDiscountPercent', // макс. скидка по промо, %
  introMonths: 'subscription.introMonths', // на сколько месяцев действует интро-скидка
  emailCampaignsEnabled: 'emailCampaigns.enabled', // общий рубильник триггерных email-кампаний (default FALSE)
  trialDays: 'trial.days', // пробный период ДЛЯ ВСЕХ новых, дней (0 = выключен)
  paymentsMode: 'payments.mode', // 'live' | 'test' — какая касса T-Bank принимает оплаты
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

/**
 * «Бесплатное занятие недели» — id видео, открытого всем даже при активном
 * paywall. Ставится вручную из админки. null — не задано.
 */
export async function getFreeLessonVideoId(): Promise<string | null> {
  try {
    const row = await prisma.appSetting.findUnique({
      where: { key: SETTING_KEYS.freeLessonVideoId },
      select: { value: true },
    });
    const v = (row?.value ?? '').trim();
    return v || null;
  } catch {
    return null; // таблицы может не быть — считаем, что не задано
  }
}

/**
 * Общий рубильник триггерных email-кампаний (welcome / первая тренировка /
 * неактивность). По умолчанию ВЫКЛЮЧЕНО: кампании деплоятся OFF и не уходят
 * реальным юзерам, пока значение не выставят в 'true'/'1' из админки. Битое/
 * пустое значение или отсутствие таблицы — тоже OFF (fail-safe).
 */
export async function getEmailCampaignsEnabled(): Promise<boolean> {
  try {
    const row = await prisma.appSetting.findUnique({
      where: { key: SETTING_KEYS.emailCampaignsEnabled },
      select: { value: true },
    });
    const v = (row?.value ?? '').trim().toLowerCase();
    return v === 'true' || v === '1';
  } catch {
    return false; // таблицы может не быть до миграции — кампании выключены
  }
}

export interface ReceiptSettings {
  enabled: boolean;
  taxation: Taxation;
  vat: Vat;
}

/**
 * Настройки чека 54-ФЗ. По умолчанию ВЫКЛЮЧЕНО: пока не подключена облачная
 * касса и не подтверждена система налогообложения, слать Receipt нельзя —
 * банк отклонит платёж, а неверные реквизиты в чеке нарушают 54-ФЗ.
 */
export async function getReceiptSettings(): Promise<ReceiptSettings> {
  let rows: { key: string; value: string }[] = [];
  try {
    rows = await prisma.appSetting.findMany({
      where: {
        key: { in: [SETTING_KEYS.receiptEnabled, SETTING_KEYS.receiptTaxation, SETTING_KEYS.receiptVat] },
      },
      select: { key: true, value: true },
    });
  } catch {
    // таблицы может не быть — чеки выключены
  }
  const map = new Map(rows.map((r) => [r.key, r.value]));
  return {
    enabled: map.get(SETTING_KEYS.receiptEnabled) === '1',
    taxation: normalizeTaxation(map.get(SETTING_KEYS.receiptTaxation)),
    vat: normalizeVat(map.get(SETTING_KEYS.receiptVat)),
  };
}

/** Целое в диапазоне [min, max] или дефолт (для битого/пустого value). */
function parseIntInRange(v: string | undefined | null, def: number, min: number, max: number): number {
  const n = Number(v);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < min || n > max) return def;
  return n;
}

/** Пробный период по умолчанию для ВСЕХ новых пользователей, дней.
 *  0 = выключен. Оферта (legal/offer) обещает 7 дней — держать в согласии. */
export const TRIAL_DAYS_DEFAULT = 7;

/**
 * Сколько дней премиума выдавать каждому новому пользователю без промокода.
 * Пусто/битое/нет таблицы — TRIAL_DAYS_DEFAULT (как обещает оферта).
 */
export async function getGlobalTrialDays(): Promise<number> {
  try {
    const row = await prisma.appSetting.findUnique({
      where: { key: SETTING_KEYS.trialDays },
      select: { value: true },
    });
    return parseIntInRange(row?.value, TRIAL_DAYS_DEFAULT, 0, 365);
  } catch {
    return TRIAL_DAYS_DEFAULT;
  }
}

/**
 * Цены подписки (редактируются из админки, /admin/paywall). Если значения не заданы
 * или таблицы нет — отдаём дефолты из PRICING_DEFAULTS. introPriceRub вычисляется.
 */
export async function getSubscriptionPricing(): Promise<SubscriptionPricing> {
  let rows: { key: string; value: string }[] = [];
  try {
    rows = await prisma.appSetting.findMany({
      where: {
        key: {
          in: [SETTING_KEYS.priceMonthly, SETTING_KEYS.introDiscountPercent, SETTING_KEYS.introMonths],
        },
      },
      select: { key: true, value: true },
    });
  } catch {
    // таблицы может не быть до миграции — дефолты
  }
  const map = new Map(rows.map((r) => [r.key, r.value]));

  const priceMonthlyRub = parseIntInRange(
    map.get(SETTING_KEYS.priceMonthly),
    PRICING_DEFAULTS.priceMonthlyRub,
    1,
    1_000_000,
  );
  const introDiscountPercent = parseIntInRange(
    map.get(SETTING_KEYS.introDiscountPercent),
    PRICING_DEFAULTS.introDiscountPercent,
    0,
    100,
  );
  const introMonths = parseIntInRange(
    map.get(SETTING_KEYS.introMonths),
    PRICING_DEFAULTS.introMonths,
    0,
    36,
  );

  return {
    priceMonthlyRub,
    introDiscountPercent,
    introMonths,
    introPriceRub: computeIntroPrice(priceMonthlyRub, introDiscountPercent),
  };
}

/**
 * Режим касс: боевая или тестовая (правка владельца). Дефолт — боевая:
 * отсутствие записи не должно случайно переводить приём денег в тест.
 */
export async function getPaymentsMode(): Promise<PaymentsMode> {
  const row = await prisma.appSetting.findUnique({ where: { key: SETTING_KEYS.paymentsMode } });
  return normalizePaymentsMode(row?.value);
}
