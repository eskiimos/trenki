import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';

// Хранилище активных admin-сессий в памяти процесса.
// При рестарте контейнера админы перелогинятся — приемлемо для текущего этапа.
const adminSessions = new Map<string, { loginTime: number }>();

const SESSION_TOKEN_LENGTH = 32;
const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 7; // 7 дней

export const ADMIN_COOKIE_NAME = 'admin_token';
export const ADMIN_SESSION_DURATION_MS = SESSION_DURATION_MS;

export function generateAdminSessionToken(): string {
  const token = crypto.randomBytes(SESSION_TOKEN_LENGTH).toString('hex');
  adminSessions.set(token, { loginTime: Date.now() });
  return token;
}

export function destroyAdminSession(token: string): void {
  adminSessions.delete(token);
}

export function validateAdminSessionToken(token: string | undefined | null): boolean {
  if (!token) return false;
  const session = adminSessions.get(token);
  if (!session) return false;
  const age = Date.now() - session.loginTime;
  if (age > SESSION_DURATION_MS) {
    adminSessions.delete(token);
    return false;
  }
  return true;
}

export function touchAdminSession(token: string): void {
  const session = adminSessions.get(token);
  if (session) session.loginTime = Date.now();
}

/**
 * Проверяет admin-сессию по cookie. Возвращает null если ок,
 * либо NextResponse 401 — тогда роут должен вернуть его.
 *
 * Использование:
 *   const denied = requireAdmin(request);
 *   if (denied) return denied;
 */
export function requireAdmin(request: NextRequest): NextResponse | null {
  const token = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
  if (!validateAdminSessionToken(token)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}

/**
 * Асинхронная версия requireAdmin: принимает либо валидный admin_token cookie
 * (классический логин по логину/паролю), либо telegramId cookie + флаг
 * isAdmin=true у соответствующего пользователя в БД.
 *
 * Это нужно потому, что admin-layout пускает Telegram-админов в /admin/*
 * без установки admin_token cookie, и без этого хелпера все защищённые
 * API-роуты возвращали бы им 401.
 */
export async function requireAdminAsync(request: NextRequest): Promise<NextResponse | null> {
  // 1) Классическая admin-сессия
  const adminToken = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
  if (validateAdminSessionToken(adminToken)) {
    return null;
  }

  // 2) Telegram-админ (юзер с isAdmin=true в БД)
  const telegramId = request.cookies.get('telegramId')?.value;
  if (telegramId) {
    try {
      const user = await prisma.user.findUnique({
        where: { telegramId },
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
 * Требует, чтобы у запроса была cookie `telegramId` (= залогиненный пользователь)
 * ИЛИ валидная admin-сессия. Используется для эндпоинтов,
 * которыми пользуются обычные пользователи (загрузка аватара и т.п.).
 *
 * Возвращает null если ок, либо NextResponse 401.
 */
export function requireUserOrAdmin(request: NextRequest): NextResponse | null {
  const adminToken = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
  if (validateAdminSessionToken(adminToken)) return null;

  const telegramId = request.cookies.get('telegramId')?.value;
  if (telegramId) return null;

  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

