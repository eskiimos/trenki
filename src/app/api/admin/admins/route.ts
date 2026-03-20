import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// Проверка наличия валидной admin-сессии через cookie
async function isAdminAuthenticated(request: NextRequest): Promise<boolean> {
  const token = request.cookies.get('admin_token')?.value;
  if (!token) return false;
  // Импортируем карту сессий через API-запрос к /api/admin/auth
  // В данной архитектуре validateSessionToken хранится в памяти auth/route.ts
  // Поэтому делаем внутренний fetch на тот же origin
  try {
    const host = request.headers.get('host') || 'localhost:3000';
    const proto = request.headers.get('x-forwarded-proto') || 'http';
    const res = await fetch(`${proto}://${host}/api/admin/auth`, {
      headers: { cookie: `admin_token=${token}` },
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** GET /api/admin/admins — список всех администраторов */
export async function GET(request: NextRequest) {
  if (!(await isAdminAuthenticated(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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
  if (!(await isAdminAuthenticated(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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
  if (!(await isAdminAuthenticated(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { telegramId } = await request.json();
  if (!telegramId) {
    return NextResponse.json({ error: 'telegramId required' }, { status: 400 });
  }

  await prisma.user.update({ where: { telegramId }, data: { isAdmin: false } });
  return NextResponse.json({ success: true });
}
