/**
 * Менеджер мульти-аккаунтов (как переключатель аккаунтов в Instagram).
 *
 * Архитектура:
 * - `localStorage.trenki_accounts` — массив сохранённых аккаунтов (до MAX_ACCOUNTS).
 * - `localStorage.trenki_auth` — данные АКТИВНОГО аккаунта (для обратной совместимости).
 * - `cookie.telegramId` — telegramId активного аккаунта (для middleware и API guards).
 *
 * При переключении: обновляем `trenki_auth`, переписываем cookie, делаем soft reload.
 */

import type { AuthData } from './auth';

const ACCOUNTS_KEY = 'trenki_accounts';
const AUTH_STORAGE_KEY = 'trenki_auth';
const ADD_ACCOUNT_FLAG = 'trenki_adding_account';

export const MAX_ACCOUNTS = 5;

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

/**
 * Получает список всех сохранённых аккаунтов.
 */
export function getAccounts(): AuthData[] {
  if (!isBrowser()) return [];
  try {
    const raw = localStorage.getItem(ACCOUNTS_KEY);
    if (!raw) {
      // Миграция: если есть старая запись trenki_auth, но нет списка — добавляем её первой
      const oldAuth = localStorage.getItem(AUTH_STORAGE_KEY);
      if (oldAuth) {
        try {
          const parsed = JSON.parse(oldAuth) as AuthData;
          if (parsed?.telegramId) {
            const list = [parsed];
            localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(list));
            return list;
          }
        } catch {}
      }
      return [];
    }
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

/**
 * Сохраняет (создаёт или обновляет) аккаунт в списке. Делает его активным.
 * Возвращает обновлённый список.
 */
export function upsertAccount(account: AuthData): AuthData[] {
  if (!isBrowser()) return [account];
  const current = getAccounts();
  const filtered = current.filter((a) => a.telegramId !== account.telegramId);
  // Активный всегда первый
  const next = [account, ...filtered].slice(0, MAX_ACCOUNTS);
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(next));
  return next;
}

/**
 * Делает аккаунт активным: переписывает `trenki_auth` и cookie telegramId.
 * Возвращает true, если переключение успешно.
 */
export function setActiveAccount(telegramId: string): boolean {
  if (!isBrowser()) return false;
  const accounts = getAccounts();
  const target = accounts.find((a) => a.telegramId === telegramId);
  if (!target) return false;

  // Двигаем активный в начало списка
  const reordered = [target, ...accounts.filter((a) => a.telegramId !== telegramId)];
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(reordered));
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(target));
  document.cookie = `telegramId=${target.telegramId}; path=/; max-age=${60 * 60 * 24 * 30}`;
  return true;
}

/**
 * Возвращает telegramId активного аккаунта (первый в списке).
 */
export function getActiveAccountId(): string | null {
  const list = getAccounts();
  return list[0]?.telegramId ?? null;
}

/**
 * Удаляет один аккаунт из списка. Если он был активным — переключается на следующий.
 * Возвращает `{ remaining, newActive }`.
 */
export function removeAccount(telegramId: string): { remaining: AuthData[]; newActive: AuthData | null } {
  if (!isBrowser()) return { remaining: [], newActive: null };
  const accounts = getAccounts();
  const remaining = accounts.filter((a) => a.telegramId !== telegramId);
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(remaining));

  const wasActive = accounts[0]?.telegramId === telegramId;
  if (wasActive) {
    const next = remaining[0] ?? null;
    if (next) {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(next));
      document.cookie = `telegramId=${next.telegramId}; path=/; max-age=${60 * 60 * 24 * 30}`;
    } else {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      document.cookie = 'telegramId=; path=/; max-age=0';
    }
    return { remaining, newActive: next };
  }
  return { remaining, newActive: accounts[0] ?? null };
}

/**
 * Очищает ВСЕ аккаунты (полный выход).
 */
export function clearAllAccounts(): void {
  if (!isBrowser()) return;
  localStorage.removeItem(ACCOUNTS_KEY);
  localStorage.removeItem(AUTH_STORAGE_KEY);
  document.cookie = 'telegramId=; path=/; max-age=0';
}

/**
 * Помечает, что пользователь идёт на /login для ДОБАВЛЕНИЯ ещё одного аккаунта.
 * Используется, чтобы при успешном логине не удалить уже существующие.
 */
export function markAddingAccount(): void {
  if (!isBrowser()) return;
  sessionStorage.setItem(ADD_ACCOUNT_FLAG, '1');
}

export function isAddingAccount(): boolean {
  if (!isBrowser()) return false;
  return sessionStorage.getItem(ADD_ACCOUNT_FLAG) === '1';
}

export function consumeAddingAccount(): boolean {
  const v = isAddingAccount();
  if (v && isBrowser()) sessionStorage.removeItem(ADD_ACCOUNT_FLAG);
  return v;
}

/**
 * Проверка — есть ли в списке аккаунтов уже такой telegramId.
 */
export function hasAccount(telegramId: string): boolean {
  return getAccounts().some((a) => a.telegramId === telegramId);
}
