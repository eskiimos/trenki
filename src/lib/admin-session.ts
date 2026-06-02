import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { getSessionFromRequest, verifySession, SESSION_COOKIE_NAME } from '@/lib/session';

const SESSION_TOKEN_BYTES = 32;
const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 7; // 7 дней

export const ADMIN_COOKIE_NAME = 'admin_token';
export const ADMIN_SESSION_DURATION_MS = SESSION_DURATION_MS;

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Создаёт новую admin-сессию. Возвращает RAW-токен (его кладём в cookie).
 * В БД хранится только sha256(token).
 */
export async function generateAdminSessionToken(): Promise<string> {
  const token = crypto.randomBytes(SESSION_TOKEN_BYTES).toString('hex');
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  await prisma.adminSession.create({
    data: { tokenHash, expiresAt },
  });
  return token;
}

export async function destroyAdminSession(token: string): Promise<void> {
  if (!token) return;
  const tokenHash = hashToken(token);
  await prisma.adminSession.deleteMany({ where: { tokenHash } });
}

/**
 * Проверяет токен, заодно продлевает `lastSeenAt` (sliding session).
 * Истёкшие сессии удаляются на лету.
 */
export async function validateAdminSessionToken(token: string | undefined | null): Promise<boolean> {
  if (!token) return false;
  const tokenHash = hashToken(token);
  const session = await prisma.adminSession.findUnique({ where: { tokenHash } });
  if (!session) return false;
  if (session.expiresAt.getTime() <= Date.now()) {
    await prisma.adminSession.deleteMany({ where: { tokenHash } });
    return false;
  }
  // Sliding expiry: при каждом валидном обращении сдвигаем дедлайн.
  await prisma.adminSession.update({
    where: { tokenHash },
    data: {
      lastSeenAt: new Date(),
      expiresAt: new Date(Date.now() + SESSION_DURATION_MS),
    },
  });
  return true;
}

/**
 * Точечная очистка протухших сессий. Безопасно вызывать редко (например, при логине).
 */
export async function cleanupExpiredAdminSessions(): Promise<void> {
  await prisma.adminSession.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
}

/**
 * Принимает либо валидную admin-сессию (login+password), либо обычного user'а
 * с флагом isAdmin=true. Используется в /api/admin/*.
 */
export async function requireAdminAsync(request: NextRequest): Promise<NextResponse | null> {
  const adminToken = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
  if (adminToken && (await validateAdminSessionToken(adminToken))) {
    return null;
  }

  const session = await getSessionFromRequest(request);
  if (session?.uid) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: session.uid },
        select: { isAdmin: true },
      });
      if (user?.isAdmin) return null;
    } catch (err) {
      console.error('requireAdminAsync: prisma error', err);
    }
  }

  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

/**
 * Версия requireAdminAsync для server components (layout/page).
 * Читает cookies() из next/headers и валидирует admin_token или user.isAdmin.
 * Возвращает true если у текущего запроса есть права админа.
 */
export async function hasAdminAccessRSC(): Promise<boolean> {
  const cookieStore = await cookies();
  const adminToken = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  if (adminToken && (await validateAdminSessionToken(adminToken))) {
    return true;
  }

  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (sessionToken) {
    const session = await verifySession(sessionToken);
    if (session?.uid) {
      try {
        const user = await prisma.user.findUnique({
          where: { id: session.uid },
          select: { isAdmin: true },
        });
        if (user?.isAdmin) return true;
      } catch (err) {
        console.error('hasAdminAccessRSC: prisma error', err);
      }
    }
  }

  return false;
}

/**
 * Требует залогиненного пользователя (через JWT-сессию) ИЛИ admin-сессию.
 * Используется для эндпоинтов, которыми пользуются обычные пользователи (аватар и т.п.).
 */
export async function requireUserOrAdmin(request: NextRequest): Promise<NextResponse | null> {
  const adminToken = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
  if (adminToken && (await validateAdminSessionToken(adminToken))) return null;

  const session = await getSessionFromRequest(request);
  if (session?.uid) return null;

  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
