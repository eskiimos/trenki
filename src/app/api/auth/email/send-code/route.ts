import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = (body.email || '').trim().toLowerCase();

    if (!email || !EMAIL_REGEX.test(email)) {
      return NextResponse.json({ error: 'Некорректный email' }, { status: 400 });
    }

    const code = generateOtp();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 минут

    // Удаляем старые коды для этого email
    await prisma.emailOtp.deleteMany({ where: { email } });

    // Создаём новый OTP
    await prisma.emailOtp.create({ data: { email, code, expiresAt } });

    // Отправляем письмо
    const result = await sendEmail({
      to: email,
      subject: 'Код входа в Треньки',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; background: #ffffff; padding: 32px; border-radius: 16px;">
          <h2 style="color: #101530; margin-bottom: 8px;">Ваш код входа</h2>
          <p style="color: #555; margin-bottom: 24px;">Используйте этот код для входа в приложение <strong>Треньки</strong>:</p>
          <div style="background: #101530; color: #A1FF4A; font-size: 40px; font-weight: bold; letter-spacing: 12px; text-align: center; padding: 28px 16px; border-radius: 12px; margin-bottom: 24px;">
            ${code}
          </div>
          <p style="color: #888; font-size: 14px;">Код действителен <strong>10 минут</strong>.</p>
          <p style="color: #888; font-size: 14px;">Если вы не запрашивали вход — просто проигнорируйте это письмо.</p>
        </div>
      `,
    });

    if (!result.success) {
      console.error('Email send failed:', result.error);
      return NextResponse.json({ error: 'Не удалось отправить письмо' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in send-code:', error);
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 });
  }
}
