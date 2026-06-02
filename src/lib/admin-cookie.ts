/**
 * Edge-safe модуль с именем admin-cookie.
 *
 * admin-session.ts тянет Node-зависимости (crypto, prisma) — его нельзя
 * импортить в middleware (edge runtime). Поэтому общая константа
 * вынесена сюда.
 */
export const ADMIN_COOKIE_NAME = 'admin_token';
