// Multi-account ВРЕМЕННО ОТКЛЮЧЁН.
// Раньше cookie ставилась с клиента и можно было держать несколько аккаунтов в localStorage,
// переключая cookie. После перехода на httpOnly JWT cookie это требует серверного флоу.
// Чтобы не блокировать P0, оставлен shim: всегда один аккаунт = активный.
// Когда понадобится — переделать на серверные сессии в БД + /api/auth/switch.

import { getAuth, clearAuth, saveAuth as saveActiveAuth, type AuthData } from './auth';

export const MAX_ACCOUNTS = 1;

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

export function getAccounts(): AuthData[] {
  const auth = getAuth();
  return auth ? [auth] : [];
}

export function upsertAccount(account: AuthData): AuthData[] {
  saveActiveAuth({
    telegramId: account.telegramId,
    firstName: account.firstName,
    lastName: account.lastName,
    username: account.username,
  });
  return getAccounts();
}

export function setActiveAccount(_telegramId: string): boolean {
  // Только один аккаунт за раз. Переключение временно не поддерживается.
  return false;
}

export function getActiveAccountId(): string | null {
  return getAuth()?.telegramId ?? null;
}

export function removeAccount(_telegramId: string): { remaining: AuthData[]; newActive: AuthData | null } {
  // Один аккаунт = удаление = полный выход.
  void clearAuth();
  return { remaining: [], newActive: null };
}

export function clearAllAccounts(): void {
  void clearAuth();
}

export function markAddingAccount(): void {
  if (!isBrowser()) return;
  sessionStorage.removeItem('trenki_adding_account');
}

export function isAddingAccount(): boolean {
  return false;
}

export function consumeAddingAccount(): boolean {
  return false;
}

export function hasAccount(telegramId: string): boolean {
  return getActiveAccountId() === telegramId;
}
