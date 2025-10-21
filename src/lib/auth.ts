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
  
  // Сохраняем в localStorage
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(data));
  
  // Сохраняем telegramId в cookies для middleware
  document.cookie = `telegramId=${data.telegramId}; path=/; max-age=${60 * 60 * 24 * 30}`; // 30 дней
  
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
 * Очищает данные авторизации (выход)
 */
export function clearAuth(): void {
  localStorage.removeItem(AUTH_STORAGE_KEY);
  
  // Удаляем cookie
  document.cookie = 'telegramId=; path=/; max-age=0';
  
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
  
  // Если нет ни WebApp, ни сохранённых данных - создаём временный ID
  // Это позволит пользователям регистрироваться без Telegram авторизации
  const tempId = localStorage.getItem('temp_user_id');
  if (tempId) {
    return tempId;
  }
  
  // Создаём новый временный ID
  const newTempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  localStorage.setItem('temp_user_id', newTempId);
  return newTempId;
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
    return {
      id: parseInt(auth.telegramId) || 0,
      telegramId: auth.telegramId,
      firstName: auth.firstName,
      lastName: auth.lastName,
      username: auth.username,
    };
  }
  
  // Dev-режим или fallback для пользователей без Telegram
  const tempId = getTelegramId();
  if (tempId) {
    return {
      id: parseInt(tempId.replace(/\D/g, '').slice(0, 10)) || Date.now(),
      telegramId: tempId,
      firstName: 'User',
      lastName: '',
      username: tempId,
    };
  }
  
  return null;
}
