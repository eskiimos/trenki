import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { signSession, setSessionCookie } from '@/lib/session';
import {
  getAccountsFromRequest,
  writeAccounts,
  addAccount,
  sameList,
  clearAccountsCookie,
  ADMIN_TTL_SECONDS,
  ACCOUNT_TTL_SECONDS,
} from '@/lib/account-list';
import { readAddIntent, clearAddIntentCookie } from '@/lib/add-intent';
import { getSessionFromRequest, sessionSecondsLeft } from '@/lib/session';
import { isSameOrigin } from '@/lib/same-origin';
import { rateLimit } from '@/lib/coach/rate-limit';
import { grantPremiumDays } from '@/lib/payments/grant';
import { sendWelcomeEmail } from '@/lib/email-campaigns';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

function getClientIp(request: NextRequest): string {
  const fwd = request.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0]!.trim();
  return request.headers.get('x-real-ip') || 'unknown';
}

export async function POST(request: NextRequest) {
  try {
    // Login-CSRF: без проверки origin с нашего же поддомена можно было бы
    // залогинить жертву в аккаунт атакующего (и подсадить его id в список
    // устройства — verify-code единственный, кто в этот список пишет).
    if (!isSameOrigin(request, { allowMissingOrigin: true })) {
      return NextResponse.json({ error: 'Запрос отклонён' }, { status: 403 });
    }

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
    // DEMO_BYPASS_EMAIL — список через запятую (демо-атлет, демо-родитель, ...)
    const demoEmails = (process.env.DEMO_BYPASS_EMAIL || '')
      .split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
    const demoCode = process.env.DEMO_BYPASS_CODE;
    const isDemoBypass = !!demoCode && demoEmails.includes(email) && code === demoCode;

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
      let trialDays = 0;
      if (refRaw) {
        const rc = await prisma.referralCode.findFirst({
          where: {
            isActive: true,
            OR: [
              { code: { equals: refRaw, mode: 'insensitive' } },
              { aliases: { has: refRaw.toLowerCase() } },
            ],
          },
          select: { code: true, trialDays: true },
        });
        if (rc) {
          referralCode = rc.code; // храним канонический код, не алиас
          trialDays = rc.trialDays; // пробный период по этому коду (0 = без триала)
        }
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

      // Пробный период по промокоду. Отдельным шагом после создания: сбой выдачи
      // триала НЕ должен ломать регистрацию/логин — в худшем случае юзер остаётся
      // FREE, и это чинится вручную. Валидируем срок, чтобы битое значение из БД
      // не выдало абсурдный премиум.
      if (referralCode && Number.isInteger(trialDays) && trialDays > 0 && trialDays <= 365) {
        try {
          await grantPremiumDays(user.id, trialDays, {
            note: `Пробный период ${trialDays} дн. по промокоду ${referralCode}`,
          });
          logger.info('trial granted on signup', { userId: user.id, referralCode, trialDays });
        } catch (e) {
          logger.error('trial grant failed on signup', { userId: user.id, referralCode, error: String(e) });
        }
      }

      // WELCOME-письмо: fire-and-forget, НЕ ломаем логин (как grantPremiumDays
      // выше). sendWelcomeEmail сам держит килл-свитч (canSendCampaign) и вернёт
      // false, если кампании выключены / нет email / юзер отписан. Дедуп-поле
      // welcomeEmailSentAt ставим только при реальной отправке — новый юзер
      // логинится только раз, ретрая нет, поэтому ставим по факту успеха.
      if (user.welcomeEmailSentAt == null) {
        const u = user;
        void (async () => {
          try {
            const ok = await sendWelcomeEmail({ id: u.id, email: u.email, emailOptOut: u.emailOptOut });
            if (ok) {
              await prisma.user.update({
                where: { id: u.id },
                data: { welcomeEmailSentAt: new Date() },
              });
            }
          } catch (e) {
            logger.error('welcome email flow failed', { userId: u.id, err: String(e) });
          }
        })();
      }
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

    // lgn — момент реального входа по коду. От него считается абсолютный
    // дедлайн доступа, в том числе для сессий, полученных переключением.
    const lgn = Math.floor(Date.now() / 1000);
    // Срок сессии одинаковый для всех, включая админов (решение владельца).
    // ВАЖНО знать про остаточный риск: requireAdminAsync/hasAdminAccessRSC
    // пускают в админку не только по отзываемому admin_token, но и по обычной
    // сессии с user.isAdmin. Сессия — stateless JWT без серверного отзыва,
    // значит забытая на чужом устройстве админская сессия открывает админку до
    // конца своего срока. Правильное лечение — требовать для /admin именно
    // admin_token (логин+пароль), а не укорачивать сессию всем админам.
    const token = await signSession({ uid: user.id, role: user.role, lgn });
    setSessionCookie(response, token);

    // ─── Мульти-аккаунт ─────────────────────────────────────────────────
    // Фича нужна ТОЛЬКО админам приложения (переключение между админ-аккаунтом
    // и тестовыми). Поэтому список ведём исключительно на «устройстве админа»:
    // либо входит сам админ, либо админ добавляет второй аккаунт из своей
    // сессии. Обычные пользователи не накапливают список вовсе — ни лишней
    // поверхности атаки, ни их email в подписанной cookie.
    //
    // Это ЕДИНСТВЕННОЕ место, где список растёт, и только после проверки кода.
    const stored = await getAccountsFromRequest(request);
    const prev = await getSessionFromRequest(request);

    // Наследуем предыдущий аккаунт ТОЛЬКО по явному намерению админа
    // («+ Добавить аккаунт» выдаёт одноразовый тикет). Одного факта «в браузере
    // лежит админская сессия» НЕДОСТАТОЧНО: под это правило попадал и
    // посторонний, вошедший своим кодом за устройством админа — он получал бы
    // админ-запись в свой список, то есть вход в админку в один тап.
    const intentUid = await readAddIntent(request);
    const prevUser =
      intentUid && prev?.uid === intentUid && prev.uid !== user.id
        ? await prisma.user.findUnique({
            where: { id: prev.uid },
            select: { id: true, isAdmin: true },
          })
        : null;
    // Тикет одноразовый — гасим независимо от исхода.
    if (intentUid) clearAddIntentCookie(response);

    // Наследование действительно только от ЖИВОЙ админской записи.
    const prevTtl = prevUser?.isAdmin ? ADMIN_TTL_SECONDS : ACCOUNT_TTL_SECONDS;
    const prevUsable =
      prevUser?.isAdmin === true && sessionSecondsLeft(prev!.lgn, new Date(), prevTtl) > 0;

    if (user.isAdmin) {
      // Вошёл сам админ — его устройство, список сохраняем и обновляем запись.
      const next = addAccount(stored, user.id, lgn, true);
      if (!sameList(next, stored)) await writeAccounts(response, next);
    } else if (prevUsable) {
      // Админ осознанно добавляет второй (тестовый) аккаунт.
      const withPrev = addAccount(stored, prevUser!.id, prev!.lgn, true);
      const next = addAccount(withPrev, user.id, lgn, false);
      if (!sameList(next, stored)) await writeAccounts(response, next);
    } else if (stored.length > 0) {
      // Обычный вход на этом устройстве: списка быть не должно. Если он остался
      // (устройство раньше принадлежало админу) — сносим, чтобы человек не
      // получил ни чужих email в переключателе, ни кнопки входа в чужой аккаунт.
      clearAccountsCookie(response);
    }

    logger.info('user login via email OTP', { userId: user.id });
    return response;
  } catch (error) {
    logger.error('verify-code failed', error);
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 });
  }
}
