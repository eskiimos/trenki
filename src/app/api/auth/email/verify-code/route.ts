import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = (body.email || '').trim().toLowerCase();
    const code = (body.code || '').trim();

    if (!email || !code) {
      return NextResponse.json({ error: 'Email и код обязательны' }, { status: 400 });
    }

    // Ищем актуальный OTP (не использованный, не истёкший)
    const otp = await prisma.emailOtp.findFirst({
      where: { email, code, used: false },
      orderBy: { createdAt: 'desc' },
    });

    if (!otp) {
      return NextResponse.json({ error: 'Неверный код' }, { status: 400 });
    }

    if (otp.expiresAt < new Date()) {
      await prisma.emailOtp.delete({ where: { id: otp.id } });
      return NextResponse.json({ error: 'Код истёк. Запросите новый.' }, { status: 400 });
    }

    // Помечаем OTP как использованный
    await prisma.emailOtp.update({ where: { id: otp.id }, data: { used: true } });

    // Ищем или создаём пользователя по email.
    // Если в cookie уже есть telegramId — это никак не влияет: мы не верим
    // содержимому cookie без проверки OTP, иначе можно подсунуть чужую cookie
    // и пройти "вход" без знания кода.
    let user = await prisma.user.findUnique({ where: { email } });
    let needsOnboarding = false;

    if (!user) {
      // Новый пользователь — генерируем уникальный ID вместо telegramId
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
      // Обновляем emailVerified если нужно
      if (!user.emailVerified) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { emailVerified: true },
        });
      }
      // Проверяем нужен ли онбординг
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

    // Ставим cookie с сервера с правильными флагами безопасности.
    // httpOnly пока НЕ включаем, т.к. клиент читает её для logout (lib/auth.ts).
    // Это будет переведено на httpOnly + /api/auth/logout позже.
    response.cookies.set('telegramId', user.telegramId, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 дней
    });

    return response;
  } catch (error) {
    console.error('Error in verify-code:', error);
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 });
  }
}
