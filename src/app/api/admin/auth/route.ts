import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import {
  ADMIN_COOKIE_NAME,
  ADMIN_SESSION_DURATION_MS,
  cleanupExpiredAdminSessions,
  destroyAdminSession,
  generateAdminSessionToken,
  validateAdminSessionToken,
} from '@/lib/admin-session';

export const dynamic = 'force-dynamic';

// Учётные данные админа берутся ТОЛЬКО из env. Без дефолтов.
const ADMIN_LOGIN = process.env.ADMIN_LOGIN;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

function timingSafeEqualStr(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

/**
 * POST /api/admin/auth — логин админа.
 */
export async function POST(request: NextRequest) {
  try {
    if (!ADMIN_LOGIN || !ADMIN_PASSWORD) {
      console.error('ADMIN_LOGIN/ADMIN_PASSWORD не заданы в env');
      return NextResponse.json({ error: 'Admin auth is not configured' }, { status: 500 });
    }

    const body = await request.json().catch(() => null);
    const login = typeof body?.login === 'string' ? body.login : '';
    const password = typeof body?.password === 'string' ? body.password : '';

    if (!login || !password) {
      return NextResponse.json({ error: 'Login and password are required' }, { status: 400 });
    }

    const okLogin = timingSafeEqualStr(login, ADMIN_LOGIN);
    const okPass = timingSafeEqualStr(password, ADMIN_PASSWORD);

    if (!okLogin || !okPass) {
      console.error(`Failed admin login attempt: ${login}`);
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // Удобный момент почистить протухшее.
    await cleanupExpiredAdminSessions().catch(() => {});

    const token = await generateAdminSessionToken();

    const response = NextResponse.json({ success: true });
    response.cookies.set(ADMIN_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: Math.floor(ADMIN_SESSION_DURATION_MS / 1000),
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Error in admin auth:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * GET /api/admin/auth — проверка валидности текущей сессии.
 * `validateAdminSessionToken` сам обновит lastSeenAt/expiresAt (sliding session).
 */
export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
    const ok = await validateAdminSessionToken(token);
    if (!ok) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }
    return NextResponse.json({ authenticated: true });
  } catch (error) {
    console.error('Error checking admin session:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/auth — выход.
 */
export async function DELETE(request: NextRequest) {
  try {
    const token = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
    if (token) await destroyAdminSession(token);

    const response = NextResponse.json({ success: true, message: 'Logged out' });
    response.cookies.delete(ADMIN_COOKIE_NAME);
    return response;
  } catch (error) {
    console.error('Error logging out admin:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
