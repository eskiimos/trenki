import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminAsync } from '@/lib/admin-session';
import { logger } from '@/lib/logger';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * PATCH /api/admin/users/[id]
 * Body: { email?: string }
 * Привязка/смена email у существующего пользователя. Нужно, чтобы Telegram-only
 * аккаунты (без настоящего email) могли войти после отключения Telegram-логина.
 *
 * Безопасность:
 *  - требуется admin-сессия;
 *  - проверяем, что email не занят другим пользователем (кроме phantom-аккаунтов
 *    с telegramId, начинающимся на "email_" — такие удаляем как заглушку);
 *  - выставляем emailVerified=true, чтобы юзер мог сразу войти OTP-ом.
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const denied = await requireAdminAsync(request);
  if (denied) return denied;

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';

  if (!email || !EMAIL_REGEX.test(email)) {
    return NextResponse.json({ error: 'Некорректный email' }, { status: 400 });
  }

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // Если email уже привязан к другому юзеру — либо это phantom (стерпит удаление),
  // либо реальный конфликт, и тогда отказ.
  const existing = await prisma.user.findFirst({
    where: { email, NOT: { id } },
  });
  if (existing) {
    if (existing.telegramId.startsWith('email_') && !existing.firstName && !existing.lastName) {
      // Чистый phantom без следов реального заполнения — сносим, освобождая email.
      await prisma.user.delete({ where: { id: existing.id } });
    } else {
      return NextResponse.json(
        { error: 'Этот email уже привязан к другому пользователю' },
        { status: 409 },
      );
    }
  }

  const updated = await prisma.user.update({
    where: { id },
    data: { email, emailVerified: true },
    select: { id: true, telegramId: true, email: true, firstName: true, lastName: true },
  });

  logger.info('admin attached email to user', { userId: id, email });

  return NextResponse.json({ success: true, user: updated });
}

/**
 * DELETE /api/admin/users/[id]
 * Удаление пользователя по id (раньше жило в /api/admin/users?userId=...).
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const denied = await requireAdminAsync(request);
  if (denied) return denied;

  const { id } = await context.params;

  try {
    await prisma.user.delete({ where: { id } });
    logger.info('admin deleted user', { userId: id });
    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error('admin delete user failed', err, { userId: id });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
