import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * POST /api/users/set-role
 * Body: { role: 'ATHLETE' | 'COACH' }
 * Устанавливает роль для текущего пользователя.
 * Менять роль можно только один раз — после смены роль зафиксирована
 * (можно вернуться к выбору позже через настройки, но в MVP это вне scope).
 *
 * Безопасно: если у пользователя уже есть профиль выбранной роли — просто проставляем role.
 */
export async function POST(request: NextRequest) {
  const telegramId = request.cookies.get('telegramId')?.value;
  if (!telegramId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const role = body?.role;

  if (role !== 'ATHLETE' && role !== 'COACH') {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { telegramId } });
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // Идемпотентно
  if (user.role === role) {
    return NextResponse.json({ success: true, role });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { role },
  });

  return NextResponse.json({ success: true, role });
}
