import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// Упрощённый вход по email без кода подтверждения (dev/test режим).
// Используется только при добавлении второго аккаунта в мульти-аккаунт системе.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = (body.email || '').trim().toLowerCase();

    if (!email) {
      return NextResponse.json({ error: 'Email обязателен' }, { status: 400 });
    }

    // Простая валидация формата
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Некорректный email' }, { status: 400 });
    }

    let user = await prisma.user.findUnique({ where: { email } });
    let needsOnboarding = false;

    if (!user) {
      const generatedId = `email_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      user = await prisma.user.create({
        data: {
          telegramId: generatedId,
          email,
          emailVerified: true,
          firstName: email.split('@')[0],
        },
      });
      needsOnboarding = true;
    } else {
      const profile = await prisma.profile.findUnique({ where: { userId: user.id } });
      needsOnboarding = !profile;
    }

    const response = NextResponse.json({
      success: true,
      user: {
        telegramId: user.telegramId,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
      },
      needsOnboarding,
    });

    response.cookies.set('telegramId', user.telegramId, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    });

    return response;
  } catch (error) {
    console.error('Error in direct-login:', error);
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 });
  }
}
