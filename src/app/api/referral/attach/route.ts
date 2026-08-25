import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuthUser } from '@/lib/coach/guards';
import { rateLimit } from '@/lib/coach/rate-limit';

/**
 * POST /api/referral/attach { code } — привязать промокод тренера к ТЕКУЩЕМУ
 * юзеру из окна подписки. Раньше поле «Промокод тренера» в модалке было
 * декорацией: значение никуда не отправлялось, промокод привязывался только
 * при регистрации (verify-code).
 *
 * Правила:
 *  · уже привязанный код НЕ перезаписывается (атрибуция канала одна на юзера);
 *  · код матчится как в /api/referral/validate: основной без регистра или алиас;
 *  · trialDays здесь НЕ выдаются — бесплатные дни только при регистрации,
 *    иначе триал фармился бы привязкой кода на старом аккаунте. Привязка даёт
 *    интро-ЦЕНУ подписки (см. resolveUserPricing).
 */
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const auth = await requireAuthUser(request);
  if ('response' in auth) return auth.response;

  // Перебор кодов с аккаунта — тот же лимит, что у публичной валидации
  if (!rateLimit(`ref-attach:${auth.user.id}`, 15, 10 * 60 * 1000).ok) {
    return NextResponse.json({ error: 'Слишком много попыток' }, { status: 429 });
  }

  if (auth.user.referralCode) {
    return NextResponse.json(
      { error: 'Промокод уже привязан к аккаунту', code: auth.user.referralCode },
      { status: 409 },
    );
  }

  const body = (await request.json().catch(() => null)) as { code?: unknown } | null;
  const raw = typeof body?.code === 'string' ? body.code.trim() : '';
  if (!raw) return NextResponse.json({ error: 'Введи промокод' }, { status: 400 });

  const rc = await prisma.referralCode.findFirst({
    where: {
      isActive: true,
      OR: [
        { code: { equals: raw, mode: 'insensitive' } },
        { aliases: { has: raw.toLowerCase() } },
      ],
    },
    select: { code: true, label: true },
  });
  if (!rc) {
    return NextResponse.json({ error: 'Такой промокод не найден' }, { status: 404 });
  }

  // Гонка двойного сабмита: обновляем только если код ещё пуст
  const res = await prisma.user.updateMany({
    where: { id: auth.user.id, referralCode: null },
    data: { referralCode: rc.code },
  });
  if (res.count === 0) {
    return NextResponse.json({ error: 'Промокод уже привязан к аккаунту' }, { status: 409 });
  }

  return NextResponse.json({ success: true, code: rc.code, label: rc.label });
}
