import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminAsync } from '@/lib/admin-session';
import { logger } from '@/lib/logger';

/**
 * POST /api/admin/users/[id]/tester
 *
 * Включение/выключение тест-режима у пользователя из админки. Тест-режим даёт
 * тот же читер-обход дневного лимита модулей и начисление XP на свободном
 * просмотре, что и админ, но БЕЗ админ-прав (для тестовых аккаунтов).
 *
 * Body: { enabled: boolean }
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const denied = await requireAdminAsync(request);
  if (denied) return denied;

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

  const enabled = body.enabled;
  if (typeof enabled !== 'boolean') {
    return NextResponse.json({ error: 'enabled должен быть boolean' }, { status: 400 });
  }

  const target = await prisma.user.findUnique({ where: { id }, select: { id: true } });
  if (!target) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const user = await prisma.user.update({
    where: { id },
    data: { isTester: enabled },
    select: { id: true, isTester: true },
  });

  logger.info('admin toggled user tester mode', { userId: id, enabled });

  return NextResponse.json({ success: true, user });
}
