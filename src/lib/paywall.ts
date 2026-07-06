// Роллаут-контроль paywall.
//
// Режим хранится в AppSetting (ключ paywall.mode), читается через getPaywallMode()
// из '@/lib/settings'. Здесь — ЧИСТАЯ логика «активен ли paywall для конкретного
// пользователя», чтобы её можно было юнит-тестировать и звать одинаково на сервере
// (guard/гейты роутов) и при отдаче статуса клиенту (/api/users/me).
//
// Смысл режима — безопасная обкатка: задеплоить paywall выключенным ('off'),
// включить сначала только для админов приложения ('admins'), затем для всех ('on').

import { hasPremium, type AccessInput } from '@/lib/access';

export type PaywallMode = 'off' | 'admins' | 'on';

export const PAYWALL_MODES: readonly PaywallMode[] = ['off', 'admins', 'on'] as const;
export const PAYWALL_MODE_DEFAULT: PaywallMode = 'off';

/** Приводит произвольную строку к валидному режиму (иначе — дефолт 'off'). */
export function normalizePaywallMode(value: string | null | undefined): PaywallMode {
  return value === 'admins' || value === 'on' || value === 'off' ? value : PAYWALL_MODE_DEFAULT;
}

export interface PaywallSubject extends AccessInput {
  isAdmin?: boolean | null; // User.isAdmin — «админ приложения» = тестер в режиме 'admins'
}

/**
 * Активен ли paywall (нужно ли гейтить платное) для ЭТОГО пользователя при данном режиме.
 * - 'off'    → никогда (всё бесплатно; безопасное состояние деплоя);
 * - premium  → никогда (активный премиум обходит paywall в любом режиме);
 * - 'on'     → для всех без премиума;
 * - 'admins' → только для админов приложения (isAdmin) без премиума — режим обкатки.
 * @param now — для тестируемости (по умолчанию — текущий момент).
 */
export function isPaywalled(
  user: PaywallSubject | null | undefined,
  mode: PaywallMode,
  now: Date = new Date(),
): boolean {
  if (!user || mode === 'off') return false;
  if (hasPremium(user, now)) return false; // активный премиум обходит paywall всегда
  if (mode === 'on') return true;
  if (mode === 'admins') return user.isAdmin === true;
  return false;
}
