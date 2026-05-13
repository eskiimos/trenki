// Библиотека для работы с авторизацией

const AUTH_STORAGE_KEY = 'trenki_auth';
const DEVICE_ID_KEY = 'trenki_device_id';

export interface AuthData {
  telegramId: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  deviceId: string;
  lastLogin: string;
}

/**
 * Генерирует уникальный ID устройства
 */
export function generateDeviceId(): string {
  const existing = localStorage.getItem(DEVICE_ID_KEY);
  if (existing) return existing;
  
  const deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  localStorage.setItem(DEVICE_ID_KEY, deviceId);
  return deviceId;
}

/**
 * Получает ID устройства
 */
export function getDeviceId(): string {
  return localStorage.getItem(DEVICE_ID_KEY) || generateDeviceId();
}

/**
 * Сохраняет данные авторизации
 */
export function saveAuth(authData: Omit<AuthData, 'deviceId' | 'lastLogin'>): void {
  const data: AuthData = {
    ...authData,
    deviceId: getDeviceId(),
    lastLogin: new Date().toISOString(),
  };

  // Сохраняем в localStorage (активный аккаунт)
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(data));

  // Сохраняем telegramId в cookies для middleware
  document.cookie = `telegramId=${data.telegramId}; path=/; max-age=${60 * 60 * 24 * 30}`; // 30 дней

  // Добавляем/обновляем в общем списке аккаунтов (мульти-аккаунт)
  // Импорт через require, чтобы избежать циклической зависимости при SSR.
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { upsertAccount } = require('./multi-account') as typeof import('./multi-account');
    upsertAccount(data);
  } catch {
    // Игнорируем — в SSR-окружении модуль может быть недоступен.
  }

  console.log('Auth saved:', data);
  console.log('Cookie set:', `telegramId=${data.telegramId}`);
}

/**
 * Получает сохранённые данные авторизации
 */
export function getAuth(): AuthData | null {
  try {
    const data = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!data) return null;
    
    const authData = JSON.parse(data) as AuthData;
    
    // Проверяем, не истёк ли срок (например, 30 дней)
    const lastLogin = new Date(authData.lastLogin);
    const daysSinceLogin = (Date.now() - lastLogin.getTime()) / (1000 * 60 * 60 * 24);
    
    if (daysSinceLogin > 30) {
      console.log('Auth expired (30+ days), clearing...');
      clearAuth();
      return null;
    }
    
    console.log('Auth loaded:', authData);
    return authData;
  } catch (error) {
    console.error('Error loading auth:', error);
    return null;
  }
}

/**
 * Обновляет время последнего входа
 */
export function updateLastLogin(): void {
  const auth = getAuth();
  if (auth) {
    auth.lastLogin = new Date().toISOString();
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(auth));
  }
}

/**
 * Очищает данные авторизации (выход).
 *
 * Если у пользователя несколько аккаунтов (мульти-аккаунт), удаляет только активный
 * и переключается на следующий. Если аккаунт один — полный выход.
 */
export function clearAuth(): void {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('./multi-account') as typeof import('./multi-account');
    const accounts = mod.getAccounts();
    const activeId = accounts[0]?.telegramId;
    if (accounts.length > 1 && activeId) {
      // Удаляем только активный — переключение на следующий произойдёт внутри removeAccount
      mod.removeAccount(activeId);
      console.log('Auth: removed active account, switched to next');
      return;
    }
    // Один или ноль аккаунтов — полная очистка
    mod.clearAllAccounts();
  } catch {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    document.cookie = 'telegramId=; path=/; max-age=0';
  }
  console.log('Auth cleared (localStorage + cookie)');
}

/**
 * Проверяет, авторизован ли пользователь
 */
export function isAuthenticated(): boolean {
  return getAuth() !== null;
}

/**
 * Получает Telegram ID из сохранённых данных или из WebApp
 */
export function getTelegramId(): string | null {
  if (typeof window === 'undefined') return null;
  
  // Сначала пытаемся получить из Telegram WebApp
  const telegramUser = (window as any).Telegram?.WebApp?.initDataUnsafe?.user;
  if (telegramUser?.id) {
    return telegramUser.id.toString();
  }
  
  // Если не получилось, берём из сохранённых данных
  const auth = getAuth();
  if (auth) {
    return auth.telegramId;
  }
  
  return null;
}

/**
 * Получает данные пользователя (объединяет Telegram и сохранённые данные)
 */
export function getUserData() {
  const telegramUser = (window as any).Telegram?.WebApp?.initDataUnsafe?.user;
  const auth = getAuth();
  
  if (telegramUser) {
    return {
      id: telegramUser.id,
      telegramId: telegramUser.id.toString(),
      firstName: telegramUser.first_name,
      lastName: telegramUser.last_name,
      username: telegramUser.username,
      photoUrl: telegramUser.photo_url,
      languageCode: telegramUser.language_code,
    };
  }
  
  if (auth) {
    // parseInt возвращает NaN для email-based telegramId (например "email_1776511893988_xxx")
    // Используем числовой id для Telegram-пользователей, строку для email-пользователей
    const numericId = parseInt(auth.telegramId);
    return {
      id: isNaN(numericId) ? auth.telegramId : numericId,
      telegramId: auth.telegramId,
      firstName: auth.firstName,
      lastName: auth.lastName,
      username: auth.username,
    };
  }

  return null;
}
