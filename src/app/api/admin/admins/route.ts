import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdminAsync } from '@/lib/admin-session';

/** GET /api/admin/admins — список всех администраторов */
export async function GET(request: NextRequest) {
  const denied = await requireAdminAsync(request);
  if (denied) return denied;

  const admins = await prisma.user.findMany({
    where: { isAdmin: true },
    select: {
      id: true,
      telegramId: true,
      firstName: true,
      lastName: true,
      username: true,
      email: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  return NextResponse.json({ admins });
}

/** POST /api/admin/admins — назначить пользователя админом */
export async function POST(request: NextRequest) {
  const denied = await requireAdminAsync(request);
  if (denied) return denied;

  const { telegramId } = await request.json();
  if (!telegramId) {
    return NextResponse.json({ error: 'telegramId required' }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { telegramId } });
  if (!user) {
    return NextResponse.json({ error: 'Пользователь не найден' }, { status: 404 });
  }

  await prisma.user.update({ where: { telegramId }, data: { isAdmin: true } });
  return NextResponse.json({ success: true });
}

/** DELETE /api/admin/admins — снять права администратора */
export async function DELETE(request: NextRequest) {
  const denied = await requireAdminAsync(request);
  if (denied) return denied;

  const { telegramId } = await request.json();
  if (!telegramId) {
    return NextResponse.json({ error: 'telegramId required' }, { status: 400 });
  }

  await prisma.user.update({ where: { telegramId }, data: { isAdmin: false } });
  return NextResponse.json({ success: true });
}
