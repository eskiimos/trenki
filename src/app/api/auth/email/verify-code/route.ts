import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { signSession, setSessionCookie } from '@/lib/session';
import { rateLimit } from '@/lib/coach/rate-limit';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

function getClientIp(request: NextRequest): string {
  const fwd = request.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0]!.trim();
  return request.headers.get('x-real-ip') || 'unknown';
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = (body.email || '').trim().toLowerCase();
    const code = (body.code || '').trim();

    if (!email || !code) {
      return NextResponse.json({ error: 'Email и код обязательны' }, { status: 400 });
    }

    // 5 неуспешных попыток на пару (email + IP) в окне 15 минут
    const rlKey = `otp-verify:${email}:${getClientIp(request)}`;
    const rl = rateLimit(rlKey, 5, 15 * 60 * 1000);
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'Слишком много попыток, попробуйте позже' },
        { status: 429 },
      );
    }

    // Demo-bypass: один заранее заведённый email заходит по фиксированному
    // коду из env, минуя проверку EmailOtp. Используется для demo/QA, чтобы
    // не зависеть от живого email-ящика.
    const demoEmail = process.env.DEMO_BYPASS_EMAIL?.trim().toLowerCase();
    const demoCode = process.env.DEMO_BYPASS_CODE;
    const isDemoBypass =
      !!demoEmail && !!demoCode && email === demoEmail && code === demoCode;

    if (!isDemoBypass) {
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

      await prisma.emailOtp.update({ where: { id: otp.id }, data: { used: true } });
    } else {
      logger.info('demo bypass verify-code', { email });
    }

    // Ищем или создаём пользователя по email.
    let user = await prisma.user.findUnique({ where: { email } });
    let needsOnboarding = false;

    if (!user) {
      // Реф-код канала (по ссылке /r/<code> или ручным вводом). Привязываем
      // ТОЛЬКО при создании нового пользователя и только если код активен.
      const refRaw = (body.referralCode || '').trim();
      let referralCode: string | null = null;
      if (refRaw) {
        const rc = await prisma.referralCode.findFirst({
          where: { code: { equals: refRaw, mode: 'insensitive' }, isActive: true },
          select: { code: true },
        });
        if (rc) referralCode = rc.code;
      }

      const generatedId = `email_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      user = await prisma.user.create({
        data: {
          telegramId: generatedId,
          email,
          emailVerified: true,
          firstName: email.split('@')[0],
          referralCode,
        },
      });
      needsOnboarding = true;
    } else {
      if (!user.emailVerified) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { emailVerified: true },
        });
      }
      const profile = await prisma.profile.findUnique({ where: { userId: user.id } });
      needsOnboarding = !profile;
    }

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
      },
      needsOnboarding,
    });

    const token = await signSession({ uid: user.id, role: user.role });
    setSessionCookie(response, token);
    logger.info('user login via email OTP', { userId: user.id });
    return response;
  } catch (error) {
    logger.error('verify-code failed', error);
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 });
  }
}
