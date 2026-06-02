import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdminAsync } from '@/lib/admin-session';

/**
 * Находит пользователя по identifier — пробует email, потом User.id,
 * потом telegramId. Это нужно потому что email-юзеры имеют синтетический
 * telegramId="email_..." — раньше их нельзя было сделать админом.
 */
async function findUserByAnyIdentifier(identifier: string) {
  const trimmed = identifier.trim();
  if (!trimmed) return null;

  if (trimmed.includes('@')) {
    return prisma.user.findUnique({ where: { email: trimmed.toLowerCase() } });
  }

  // cuid выглядит как "cm..." (24 chars), User.id у нас @default(cuid())
  const byId = await prisma.user.findUnique({ where: { id: trimmed } });
  if (byId) return byId;

  return prisma.user.findUnique({ where: { telegramId: trimmed } });
}

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

  const body = await request.json().catch(() => ({}));
  // Принимаем identifier (новое поле). Для обратной совместимости — поддерживаем
  // старое поле telegramId, если фронт его ещё шлёт.
  const identifier: string | undefined = body?.identifier ?? body?.telegramId;
  if (!identifier || typeof identifier !== 'string') {
    return NextResponse.json(
      { error: 'identifier required (email или User ID)' },
      { status: 400 },
    );
  }

  const user = await findUserByAnyIdentifier(identifier);
  if (!user) {
    return NextResponse.json({ error: 'Пользователь не найден' }, { status: 404 });
  }

  await prisma.user.update({ where: { id: user.id }, data: { isAdmin: true } });
  return NextResponse.json({ success: true });
}

/** DELETE /api/admin/admins — снять права администратора */
export async function DELETE(request: NextRequest) {
  const denied = await requireAdminAsync(request);
  if (denied) return denied;

  const body = await request.json().catch(() => ({}));
  const identifier: string | undefined = body?.identifier ?? body?.telegramId;
  if (!identifier || typeof identifier !== 'string') {
    return NextResponse.json(
      { error: 'identifier required (email или User ID)' },
      { status: 400 },
    );
  }

  const user = await findUserByAnyIdentifier(identifier);
  if (!user) {
    return NextResponse.json({ error: 'Пользователь не найден' }, { status: 404 });
  }

  await prisma.user.update({ where: { id: user.id }, data: { isAdmin: false } });
  return NextResponse.json({ success: true });
}
