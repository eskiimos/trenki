// ─── Интент «админ добавляет ещё один аккаунт» ──────────────────────────────
//
// ЗАЧЕМ. Мульти-аккаунт — фича админа: он держит рядом свой аккаунт и тестовые.
// Наивное правило «если в браузере лежит живая админская сессия, значит это
// устройство админа» НЕБЕЗОПАСНО: под него попадает и посторонний, который сел
// за устройство и вошёл СВОИМ кодом. Он получал бы админ-запись в свой
// подписанный список — то есть дверь в админку в один тап (а оттуда
// POST /api/admin/admins делает его админом навсегда). Тот же эффект случайно
// ловил бы любой, кому админ одолжил планшет: он видел бы email админа и
// кнопку переключения.
//
// РЕШЕНИЕ. Наследование админского аккаунта требует ЯВНОГО намерения: админ
// жмёт «+ Добавить аккаунт» → сервер выдаёт короткоживущий подписанный тикет,
// привязанный к его userId. Только при валидном тикете следующий вход по коду
// сохранит админскую запись в списке устройства. Просто зашедший на /login
// человек тикета не имеет — и получает чистое устройство.

import { SignJWT, jwtVerify } from 'jose';
import type { NextRequest, NextResponse } from 'next/server';

export const ADD_INTENT_COOKIE_NAME = 'trenki_addacc';
/**
 * Тикет живёт столько, сколько реально занимает вход по коду: письмо идёт не
 * мгновенно, человек уходит в почтовый клиент и возвращается. Слишком короткий
 * срок бил бы по своим — просроченный тикет означает снос списка устройства.
 */
const ADD_INTENT_TTL_SECONDS = 30 * 60;

const JWT_ALG = 'HS256';
const JWT_ISSUER = 'trenki';
/** Своя audience — тикет нельзя подменить сессией или списком аккаунтов. */
const JWT_AUDIENCE = 'trenki-add-intent';

function getSecretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      'SESSION_SECRET is not set or shorter than 32 chars. Generate one: `openssl rand -base64 48`',
    );
  }
  return new TextEncoder().encode(secret);
}

/** Подписать тикет для конкретного админа. */
export async function signAddIntent(adminUserId: string): Promise<string> {
  return new SignJWT({ uid: adminUserId })
    .setProtectedHeader({ alg: JWT_ALG })
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${ADD_INTENT_TTL_SECONDS}s`)
    .sign(getSecretKey());
}

/** userId админа из тикета или null (нет/протух/подделан/чужая audience). */
export async function readAddIntent(request: NextRequest): Promise<string | null> {
  const token = request.cookies.get(ADD_INTENT_COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecretKey(), {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      algorithms: [JWT_ALG],
    });
    return typeof payload.uid === 'string' && payload.uid ? payload.uid : null;
  } catch {
    return null;
  }
}

export function setAddIntentCookie(response: NextResponse, token: string): void {
  response.cookies.set(ADD_INTENT_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: ADD_INTENT_TTL_SECONDS,
  });
}

/** Тикет одноразовый: гасим сразу после использования. */
export function clearAddIntentCookie(response: NextResponse): void {
  response.cookies.set(ADD_INTENT_COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}
