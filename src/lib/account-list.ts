// ─── Мульти-аккаунт: список аккаунтов, авторизованных на ЭТОМ устройстве ────
//
// МОДЕЛЬ БЕЗОПАСНОСТИ (проект уже ловил P0-IDOR, поэтому по шагам):
//
//  1. Список живёт в ПОДПИСАННОЙ httpOnly-cookie `trenki_accounts`. Клиент не
//     может её подделать или дописать туда чужой id.
//  2. Единственный, кто ДОБАВЛЯЕТ записи, — verify-code (успешный вход по коду).
//     Никакой read-роут писать в список не имеет права: иначе угнанная сессия
//     обменивалась бы на долгоживущий ключ.
//  3. Каждая запись несёт `lgn` — момент РЕАЛЬНОГО входа по коду, и живёт не
//     дольше ACCOUNT_TTL_SECONDS от него. Это абсолютный дедлайн: переподпись
//     cookie (при удалении записи, логауте и т.п.) НЕ продлевает доступ, а
//     переключение аккаунтов не может крутиться вечно. Именно этим фича не
//     ослабляет базовую 30-дневную сессию.
//  4. Переключение (`/api/auth/switch`) выдаёт сессию только для записи из
//     этого списка и только с её же дедлайном.

import { SignJWT, jwtVerify } from 'jose';
import type { NextRequest, NextResponse } from 'next/server';

export const ACCOUNTS_COOKIE_NAME = 'trenki_accounts';
/** Сколько аккаунтов одновременно помним на устройстве. */
export const MAX_ACCOUNTS = 5;
/** Сколько запись живёт после входа по коду — ровно как сессия (30 дней). */
export const ACCOUNT_TTL_SECONDS = 60 * 60 * 24 * 30;
/** Допуск на расхождение часов при проверке «lgn не из будущего». */
const CLOCK_SKEW_SECONDS = 5 * 60;

const JWT_ALG = 'HS256';
const JWT_ISSUER = 'trenki';
/** Своя audience — изоляция от session-токена (trenki-web). */
const JWT_AUDIENCE = 'trenki-accounts';

/** Запись списка: кто и когда реально вошёл по коду. */
export interface DeviceAccount {
  id: string;
  /** unix-секунды входа по коду */
  lgn: number;
}

function getSecretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      'SESSION_SECRET is not set or shorter than 32 chars. Generate one: `openssl rand -base64 48`',
    );
  }
  return new TextEncoder().encode(secret);
}

function nowSec(now: Date = new Date()): number {
  return Math.floor(now.getTime() / 1000);
}

/* ─── Чистые операции над списком (тестируются без БД) ──────────────────── */

/** Не истёк ли доступ по этой записи. */
export function isAccountAlive(a: DeviceAccount, now: Date = new Date()): boolean {
  return a.lgn + ACCOUNT_TTL_SECONDS > nowSec(now);
}

/** Убирает протухшие записи (дедлайн от реального входа). */
export function pruneExpired(list: DeviceAccount[], now: Date = new Date()): DeviceAccount[] {
  return list.filter((a) => isAccountAlive(a, now));
}

/**
 * Добавляет/обновляет запись: последний вошедший — первым, дубли схлопываются,
 * список обрезается до MAX_ACCOUNTS. `lgn` записи ОБНОВЛЯЕТСЯ только здесь —
 * то есть только реальным входом по коду.
 */
export function addAccount(
  list: DeviceAccount[],
  id: string,
  lgn: number,
): DeviceAccount[] {
  const next = [{ id, lgn }, ...list.filter((a) => a.id !== id)];
  return next.slice(0, MAX_ACCOUNTS);
}

/** Убирает запись по id. */
export function removeAccount(list: DeviceAccount[], id: string): DeviceAccount[] {
  return list.filter((a) => a.id !== id);
}

/** Совпадают ли списки (чтобы не переподписывать cookie без нужды). */
export function sameList(a: DeviceAccount[], b: DeviceAccount[]): boolean {
  return a.length === b.length && a.every((x, i) => x.id === b[i].id && x.lgn === b[i].lgn);
}

/** Запись по id (или null). */
export function findAccount(list: DeviceAccount[], id: string): DeviceAccount | null {
  return list.find((a) => a.id === id) ?? null;
}

/* ─── Подпись/проверка ──────────────────────────────────────────────────── */

/**
 * Срок жизни cookie = самый поздний дедлайн среди записей. Дольше держать
 * бессмысленно: все записи к тому моменту протухнут.
 */
function cookieMaxAge(list: DeviceAccount[], now: Date = new Date()): number {
  const latest = list.reduce((max, a) => Math.max(max, a.lgn + ACCOUNT_TTL_SECONDS), 0);
  return Math.max(0, latest - nowSec(now));
}

/**
 * Отбрасывает битые записи. Санитайз ОДИН на всех: и `exp` токена, и `Max-Age`
 * cookie обязаны считаться по одному и тому же списку, иначе сроки разъедутся.
 */
export function sanitize(list: DeviceAccount[]): DeviceAccount[] {
  return list
    .filter((a) => a && typeof a.id === 'string' && a.id.length > 0 && Number.isFinite(a.lgn))
    .slice(0, MAX_ACCOUNTS);
}

export async function signAccounts(list: DeviceAccount[], now: Date = new Date()): Promise<string> {
  const items = sanitize(list);
  return new SignJWT({ accounts: items })
    .setProtectedHeader({ alg: JWT_ALG })
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(nowSec(now) + Math.max(60, cookieMaxAge(items, now)))
    .sign(getSecretKey());
}

/** Список из токена: [] при отсутствии/подделке/чужой audience. Протухшие записи отброшены. */
export async function verifyAccounts(token: string, now: Date = new Date()): Promise<DeviceAccount[]> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey(), {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      algorithms: [JWT_ALG],
    });
    const raw = payload.accounts;
    if (!Array.isArray(raw)) return [];
    const seen = new Set<string>();
    const list: DeviceAccount[] = [];
    for (const item of raw) {
      const id = (item as { id?: unknown })?.id;
      const lgn = (item as { lgn?: unknown })?.lgn;
      if (typeof id !== 'string' || !id || typeof lgn !== 'number' || !Number.isFinite(lgn)) continue;
      // Верхняя граница: `lgn` из будущего растянул бы и запись, и срок cookie
      // за TTL. Сейчас недостижимо (пишет только сервер), но на этом держится
      // весь абсолютный дедлайн — инвариант должен защищать себя сам.
      if (lgn > nowSec(now) + CLOCK_SKEW_SECONDS) continue;
      if (seen.has(id)) continue;
      seen.add(id);
      list.push({ id, lgn });
    }
    return pruneExpired(list, now).slice(0, MAX_ACCOUNTS);
  } catch {
    return [];
  }
}

/* ─── Cookie-хелперы ────────────────────────────────────────────────────── */

export async function getAccountsFromRequest(request: NextRequest): Promise<DeviceAccount[]> {
  const token = request.cookies.get(ACCOUNTS_COOKIE_NAME)?.value;
  if (!token) return [];
  return verifyAccounts(token);
}

export function clearAccountsCookie(response: NextResponse): void {
  response.cookies.set(ACCOUNTS_COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}

/**
 * Записать список в ответ. Вызывать ТОЛЬКО когда список реально изменился —
 * проверяй `sameList` у вызывающего (лишняя переподпись не продлевает доступ
 * по записям, но и смысла в ней нет).
 */
export async function writeAccounts(
  response: NextResponse,
  rawList: DeviceAccount[],
  now: Date = new Date(),
): Promise<void> {
  // Санитайзим ЗДЕСЬ и дальше используем один и тот же массив — иначе Max-Age
  // cookie считался бы по сырому списку, а exp токена по очищенному.
  const list = sanitize(rawList);
  if (list.length === 0) {
    clearAccountsCookie(response);
    return;
  }
  response.cookies.set(ACCOUNTS_COOKIE_NAME, await signAccounts(list, now), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: Math.max(60, cookieMaxAge(list, now)),
  });
}

/** Куда вести пользователя после переключения — по его роли. */
export function redirectForRole(role: string): string {
  if (role === 'COACH') return '/coach/team';
  if (role === 'PARENT') return '/parent';
  return '/';
}
