/**
 * Утилиты для определения окружения разработки
 */

/**
 * Проверяет, запущено ли приложение на localhost
 */
export function isLocalhost(): boolean {
  if (typeof window === 'undefined') return false;
  
  const hostname = window.location.hostname;
  return hostname === 'localhost' || hostname === '127.0.0.1';
}

/**
 * Проверяет, запущено ли приложение в режиме разработки
 */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development';
}

/**
 * Проверяет, запущено ли приложение в production
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

/**
 * Возвращает dev-окружение (true если localhost или development mode)
 */
export function isDevEnvironment(): boolean {
  return isLocalhost() || isDevelopment();
}
