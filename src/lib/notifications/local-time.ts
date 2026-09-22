// Локальное время пользователя для кронов уведомлений: дата (YYYY-MM-DD) и
// минута от полуночи по User.timezone. Битая или пустая таймзона — МСК.
// Форматтеры кэшируются по таймзоне: крон зовёт это каждую минуту на каждого
// подписчика, а new Intl.DateTimeFormat — дорогой.

export const DEFAULT_TZ = 'Europe/Moscow';

const dateFormatters = new Map<string, Intl.DateTimeFormat>();
const timeFormatters = new Map<string, Intl.DateTimeFormat>();

function cached(
  cache: Map<string, Intl.DateTimeFormat>,
  tz: string,
  make: (zone: string) => Intl.DateTimeFormat,
): Intl.DateTimeFormat {
  let f = cache.get(tz);
  if (!f) {
    f = make(tz); // битая tz бросает здесь и в кэш не попадает
    cache.set(tz, f);
  }
  return f;
}

function withTz<T>(tz: string | null | undefined, read: (zone: string) => T): T {
  try {
    return read(tz || DEFAULT_TZ);
  } catch {
    return read(DEFAULT_TZ);
  }
}

/** Локальная дата «YYYY-MM-DD». */
export function localDateStr(now: Date, tz: string | null | undefined): string {
  return withTz(tz, (zone) =>
    cached(dateFormatters, zone, (z) => new Intl.DateTimeFormat('en-CA', { timeZone: z })).format(now),
  );
}

/** Минута от локальной полуночи (0…1439). */
export function localMinuteOfDay(now: Date, tz: string | null | undefined): number {
  return withTz(tz, (zone) => {
    const parts = cached(
      timeFormatters,
      zone,
      (z) => new Intl.DateTimeFormat('en-US', { timeZone: z, hour: '2-digit', minute: '2-digit', hour12: false }),
    ).formatToParts(now);
    const h = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
    const m = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
    // hour12:false может дать "24" в полночь — нормализуем через %24.
    return ((Number.isFinite(h) ? h : 0) % 24) * 60 + (Number.isFinite(m) ? m : 0);
  });
}
