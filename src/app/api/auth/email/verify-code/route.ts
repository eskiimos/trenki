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

    // Если пользователь уже авторизован через Telegram — он просто добавляет email к профилю
    const cookieTelegramId = request.cookies.get('telegramId')?.value;
    const isAlreadyAuthed = cookieTelegramId && !cookieTelegramId.startsWith('email_');
    if (isAlreadyAuthed) {
      return NextResponse.json({
        success: true,
        user: { telegramId: cookieTelegramId },
        needsOnboarding: false,
      });
    }

    // Ищем или создаём пользователя (только для входа через email)
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

    return NextResponse.json({
      success: true,
      user: {
        telegramId: user.telegramId,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
      },
      needsOnboarding,
    });
  } catch (error) {
    console.error('Error in verify-code:', error);
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 });
  }
}
