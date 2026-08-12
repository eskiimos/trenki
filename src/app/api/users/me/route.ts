import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSessionUserId } from '@/lib/auth-server';
import { hasPremium } from '@/lib/access';
import { isPaywalled } from '@/lib/paywall';
import { getPaywallMode, getFreeLessonVideoId } from '@/lib/settings';

export const dynamic = 'force-dynamic';

/**
 * GET /api/users/me
 * Возвращает данные текущего пользователя (по подписанной сессии).
 */
export async function GET(request: NextRequest) {
  const userId = await getSessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      profile: { select: { id: true } },
      coachProfile: { select: { userId: true, clubName: true } },
    },
  });

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  let activeTeamId: string | null = null;
  if (user.role === 'COACH') {
    const team = await prisma.team.findFirst({
      where: { createdBy: user.id },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    activeTeamId = team?.id ?? null;
  }

  // Статус подписки для клиента: premium — есть ли активный доступ; paywalled —
  // нужно ли ЭТОМУ юзеру показывать paywall (с учётом режима obкатки paywall.mode).
  // premiumUntil нужен клиенту для отсчёта «подписка кончается через N дней».
  const mode = await getPaywallMode();
  const premium = hasPremium(user);
  // «Урок недели» — единственный контент, открытый FREE-юзеру, когда paywall
  // активен. Клиент подставляет его в карточку на главной.
  const freeLessonVideoId = await getFreeLessonVideoId();

  return NextResponse.json({
    id: user.id,
    telegramId: user.telegramId,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    isAdmin: user.isAdmin,
    hasAthleteProfile: Boolean(user.profile),
    hasCoachProfile: Boolean(user.coachProfile),
    coachClubName: user.coachProfile?.clubName ?? null,
    activeTeamId,
    // Подписка / paywall
    hasPremium: premium,
    premiumUntil: user.premiumUntil,
    paywalled: isPaywalled(user, mode),
    paywallActive: mode !== 'off', // включён ли paywall вообще (для premium-UI: баннер продления)
    referralCode: user.referralCode, // канал (для окна «Оформить» — поле промокода тренера)
    freeLessonVideoId, // «урок недели» для FREE (id видео или null, если не назначен)
  });
}
