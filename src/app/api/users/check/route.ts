import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSessionUserId } from '@/lib/auth-server';

/**
 * GET /api/users/check
 * Возвращает существование/базовый профиль ТЕКУЩЕГО (по сессии) пользователя.
 * Раньше принимал telegramId из query — это позволяло проверять чужие аккаунты.
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await getSessionUserId(request);
    if (!userId) {
      return NextResponse.json({ exists: false, user: null }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        telegramId: true,
        firstName: true,
        profile: {
          select: {
            birthDate: true,
            gender: true,
          },
        },
      },
    });

    return NextResponse.json({ exists: !!user, user });
  } catch (error) {
    console.error('Error checking user:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
