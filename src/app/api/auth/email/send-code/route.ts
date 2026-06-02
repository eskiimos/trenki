import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/email';
import { rateLimit } from '@/lib/coach/rate-limit';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getClientIp(request: NextRequest): string {
  const fwd = request.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0]!.trim();
  return request.headers.get('x-real-ip') || 'unknown';
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = (body.email || '').trim().toLowerCase();

    if (!email || !EMAIL_REGEX.test(email)) {
      return NextResponse.json({ error: 'Некорректный email' }, { status: 400 });
    }

    // Demo-bypass: для одного конкретного email письмо не отправляем,
    // вход идёт по фиксированному коду DEMO_BYPASS_CODE (см. verify-code).
    const demoEmail = process.env.DEMO_BYPASS_EMAIL?.trim().toLowerCase();
    if (demoEmail && email === demoEmail && process.env.DEMO_BYPASS_CODE) {
      logger.info('demo bypass send-code', { email });
      return NextResponse.json({ success: true });
    }

    // Лимит: не более 3 кодов на email за 10 минут И не более 10 кодов с одного IP за 10 минут
    const emailRl = rateLimit(`otp-send:email:${email}`, 3, 10 * 60 * 1000);
    if (!emailRl.ok) {
      return NextResponse.json(
        { error: 'Слишком частые запросы кода. Попробуйте через несколько минут.' },
        { status: 429 },
      );
    }
    const ipRl = rateLimit(`otp-send:ip:${getClientIp(request)}`, 10, 10 * 60 * 1000);
    if (!ipRl.ok) {
      return NextResponse.json(
        { error: 'Слишком много запросов. Попробуйте позже.' },
        { status: 429 },
      );
    }

    const code = generateOtp();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 минут

    await prisma.emailOtp.deleteMany({ where: { email } });
    await prisma.emailOtp.create({ data: { email, code, expiresAt } });

    // DEV: без RESEND_API_KEY — возвращаем код в ответе и пишем в консоль.
    const isDevBypass =
      process.env.NODE_ENV !== 'production' || !process.env.RESEND_API_KEY;

    if (isDevBypass) {
      logger.info('dev OTP issued', { email, code });
      return NextResponse.json({ success: true, devCode: code });
    }

    logger.info('OTP requested', { email });

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
      logger.error('Email send failed', result.error);
      return NextResponse.json({ error: 'Не удалось отправить письмо' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('send-code failed', error);
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 });
  }
}
