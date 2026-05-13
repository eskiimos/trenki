import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * GET /api/users/me
 * Возвращает данные текущего пользователя по cookie telegramId.
 * Включает role, наличие профиля игрока, наличие профиля тренера, активную команду.
 */
export async function GET(request: NextRequest) {
  const telegramId = request.cookies.get('telegramId')?.value;
  if (!telegramId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { telegramId },
    include: {
      profile: { select: { id: true } },
      coachProfile: { select: { userId: true, clubName: true } },
    },
  });

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // Для тренера — первая (активная) команда
  let activeTeamId: string | null = null;
  if (user.role === 'COACH') {
    const team = await prisma.team.findFirst({
      where: { createdBy: user.id },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    activeTeamId = team?.id ?? null;
  }

  return NextResponse.json({
    id: user.id,
    telegramId: user.telegramId,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    hasAthleteProfile: Boolean(user.profile),
    hasCoachProfile: Boolean(user.coachProfile),
    coachClubName: user.coachProfile?.clubName ?? null,
    activeTeamId,
  });
}
