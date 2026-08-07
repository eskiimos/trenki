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

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ uid: payload.uid, role: payload.role })
    .setProtectedHeader({ alg: JWT_ALG })
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
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
    return { uid, role };
  } catch {
    return null;
  }
}

export async function getSessionFromRequest(request: NextRequest): Promise<SessionPayload | null> {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySession(token);
}

export function setSessionCookie(response: NextResponse, token: string): void {
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
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
