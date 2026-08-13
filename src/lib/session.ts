import { SignJWT, jwtVerify } from 'jose';
import type { NextRequest } from 'next/server';
import type { NextResponse } from 'next/server';

export const SESSION_COOKIE_NAME = 'trenki_session';
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 дней
const JWT_ALG = 'HS256';
const JWT_ISSUER = 'trenki';
const JWT_AUDIENCE = 'trenki-web';

export interface SessionPayload {
  uid: string; // User.id (cuid)
  role: 'ATHLETE' | 'COACH' | 'PARENT';
  /**
   * Момент РЕАЛЬНОГО входа по коду (unix-секунды) — абсолютный дедлайн доступа.
   * Сессия истекает через SESSION_MAX_AGE от `lgn`, а не от момента выдачи,
   * поэтому переключение аккаунтов (/api/auth/switch) не может продлевать
   * доступ бесконечно: производный токен не переживает исходный логин.
   * У старых токенов claim отсутствует — берём `iat` (см. verifySession).
   */
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

/** Абсолютный срок жизни доступа от момента входа по коду (unix-секунды). */
export function sessionDeadline(lgn: number): number {
  return lgn + SESSION_MAX_AGE_SECONDS;
}

/** Сколько секунд осталось до дедлайна (0, если истёк). */
export function sessionSecondsLeft(lgn: number, now: Date = new Date()): number {
  return Math.max(0, sessionDeadline(lgn) - Math.floor(now.getTime() / 1000));
}

export async function signSession(payload: SessionPayload): Promise<string> {
  // exp считаем от РЕАЛЬНОГО логина, а не от «сейчас»: иначе переключение
  // аккаунтов туда-обратно продлевало бы доступ без ограничений.
  return new SignJWT({ uid: payload.uid, role: payload.role, lgn: payload.lgn })
    .setProtectedHeader({ alg: JWT_ALG })
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(sessionDeadline(payload.lgn))
    .sign(getSecretKey());
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey(), {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      algorithms: [JWT_ALG],
    });
    const uid = typeof payload.uid === 'string' ? payload.uid : null;
    // Неизвестные значения нормализуются в безопасный дефолт ATHLETE.
    const role =
      payload.role === 'COACH' ? 'COACH' : payload.role === 'PARENT' ? 'PARENT' : 'ATHLETE';
    if (!uid) return null;
    // Токены, выпущенные до появления claim'а, не разлогиниваем: их дедлайн —
    // от iat (который signSession всегда проставляет), то есть прежние 30 дней.
    // Если нет ни lgn, ни iat — отвергаем токен (fail closed). Подстановка
    // «сейчас» выдавала бы свежие 30 дней, т.е. продление вместо отказа.
    const lgn =
      typeof payload.lgn === 'number' && Number.isFinite(payload.lgn)
        ? payload.lgn
        : typeof payload.iat === 'number' && Number.isFinite(payload.iat)
          ? payload.iat
          : null;
    if (lgn === null) return null;
    return { uid, role, lgn };
  } catch {
    return null;
  }
}

export async function getSessionFromRequest(request: NextRequest): Promise<SessionPayload | null> {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySession(token);
}

export function setSessionCookie(
  response: NextResponse,
  token: string,
  /** Обычно — остаток до дедлайна (sessionSecondsLeft), чтобы cookie не жила дольше токена. */
  maxAgeSeconds: number = SESSION_MAX_AGE_SECONDS,
): void {
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: Math.max(0, Math.floor(maxAgeSeconds)),
  });
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}
