// Клиентский auth-хелпер.
// ВАЖНО: с клиента мы БОЛЬШЕ НЕ ставим cookie. Источник истины — httpOnly JWT,
// который сервер выдаёт в /api/auth/email/verify-code и проверяет в middleware/guards.
// Здесь только локальный кеш профиля для UX (имя, аватар) и хелперы.

const AUTH_STORAGE_KEY = 'trenki_auth';
const DEVICE_ID_KEY = 'trenki_device_id';

export interface AuthData {
  telegramId: string; // historical: User.telegramId (для email-юзеров — "email_..." id)
  firstName?: string;
  lastName?: string;
  username?: string;
  deviceId: string;
  lastLogin: string;
}

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

export function generateDeviceId(): string {
  if (!isBrowser()) return 'ssr';
  const existing = localStorage.getItem(DEVICE_ID_KEY);
  if (existing) return existing;
  const deviceId = `device_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  localStorage.setItem(DEVICE_ID_KEY, deviceId);
  return deviceId;
}

export function getDeviceId(): string {
  if (!isBrowser()) return 'ssr';
  return localStorage.getItem(DEVICE_ID_KEY) || generateDeviceId();
}

/**
 * Кешируем имя/фамилию в localStorage после логина. К безопасности отношения не имеет.
 */
export function saveAuth(authData: Omit<AuthData, 'deviceId' | 'lastLogin'>): void {
  if (!isBrowser()) return;
  const data: AuthData = {
    ...authData,
    deviceId: getDeviceId(),
    lastLogin: new Date().toISOString(),
  };
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(data));
}

export function getAuth(): AuthData | null {
  if (!isBrowser()) return null;
  try {
    const data = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!data) return null;
    const authData = JSON.parse(data) as AuthData;

    const lastLogin = new Date(authData.lastLogin);
    const daysSinceLogin = (Date.now() - lastLogin.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceLogin > 30) {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      return null;
    }
    return authData;
  } catch {
    return null;
  }
}

export function updateLastLogin(): void {
  if (!isBrowser()) return;
  const auth = getAuth();
  if (auth) {
    auth.lastLogin = new Date().toISOString();
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(auth));
  }
}

/**
 * Выход: дёргает серверный logout (он удалит httpOnly cookie), чистит локальный кеш.
 * Возвращает Promise, но вызовы могут не ожидать его — это ок, мы потом редиректим.
 */
export async function clearAuth(): Promise<void> {
  if (!isBrowser()) return;
  try {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
  } catch {
    // даже если сервер недоступен, локально дочистим
  }
  localStorage.removeItem(AUTH_STORAGE_KEY);
  // Старая неподписанная cookie могла висеть после миграции
  document.cookie = 'telegramId=; path=/; max-age=0';
}

export function isAuthenticated(): boolean {
  return getAuth() !== null;
}

/**
 * Совместимость со старым кодом. Telegram-интеграция отключена,
 * поэтому возвращаем telegramId из локального кеша (если есть).
 */
export function getTelegramId(): string | null {
  return getAuth()?.telegramId ?? null;
}

/**
 * Возвращает данные пользователя для отображения. Источник — localStorage-кеш
 * (записывается после успешного логина). Это НЕ источник истины для auth.
 */
export function getUserData() {
  const auth = getAuth();
  if (!auth) return null;
  const numericId = parseInt(auth.telegramId, 10);
  return {
    id: Number.isNaN(numericId) ? auth.telegramId : numericId,
    telegramId: auth.telegramId,
    firstName: auth.firstName,
    lastName: auth.lastName,
    username: auth.username,
  };
}
