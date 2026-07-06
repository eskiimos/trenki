import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireCoach, requireTeamOwnership } from '@/lib/coach/guards';
import { hasPremium } from '@/lib/access';
import { isPaywalled } from '@/lib/paywall';
import { getPaywallMode } from '@/lib/settings';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/teams/[id]/members[?status=PENDING|ACTIVE]
 * Возвращает список членов команды с профилями и потенциалом.
 * Только владелец команды может видеть.
 *
 * status=PENDING — заявки на вступление (упрощённый shape: имя, email,
 * без потенциала). По умолчанию — ACTIVE.
 */
export async function GET(request: NextRequest, ctx: RouteContext) {
  const auth = await requireCoach(request);
  if ('response' in auth) return auth.response;

  const { id: teamId } = await ctx.params;
  const owns = await requireTeamOwnership(auth.user.id, teamId);
  if (!owns) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const statusParam = request.nextUrl.searchParams.get('status');
  const wantPending = statusParam === 'PENDING';

  if (wantPending) {
    const requests = await prisma.teamMember.findMany({
      where: { teamId, status: 'PENDING' },
      orderBy: { joinedAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            profile: { select: { avatarUrl: true, position: true } },
          },
        },
      },
    });
    return NextResponse.json({
      pending: requests.map((m) => ({
        memberId: m.id,
        userId: m.userId,
        firstName: m.user.firstName,
        lastName: m.user.lastName,
        email: m.user.email,
        avatarUrl: m.user.profile?.avatarUrl ?? null,
        position: m.user.profile?.position ?? null,
        requestedAt: m.joinedAt,
      })),
    });
  }

  const members = await prisma.teamMember.findMany({
    where: { teamId, status: 'ACTIVE' },
    orderBy: { joinedAt: 'asc' },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          accessTier: true,
          premiumUntil: true,
          isAdmin: true,
          profile: {
            select: {
              position: true,
              number: true,
              avatarUrl: true,
              potential: true,
              ratingPower: true,
              ratingSpeed: true,
              ratingEndurance: true,
              ratingTechnique: true,
              ratingFlexibility: true,
            },
          },
        },
      },
    },
  });

  // Параллельно — последние активные задания каждому игроку
  const memberUserIds = members.map((m) => m.userId);
  const assignments = memberUserIds.length === 0
    ? []
    : await prisma.trainingAssignment.findMany({
      where: {
        teamId,
        athleteId: { in: memberUserIds },
        status: { in: ['PENDING', 'IN_PROGRESS'] },
      },
      select: { athleteId: true, status: true },
    });

  // Группируем: для каждого athleteId определяем статус-индикатор
  const statusByAthlete = new Map<string, 'pending' | 'in_progress' | 'completed' | 'none'>();
  for (const a of assignments) {
    const cur = statusByAthlete.get(a.athleteId);
    if (a.status === 'IN_PROGRESS' || cur === 'in_progress') {
      statusByAthlete.set(a.athleteId, 'in_progress');
    } else {
      statusByAthlete.set(a.athleteId, 'pending');
    }
  }

  // Режим paywall — чтобы отдать тренеру ТОЧНЫЙ признак «кому нельзя выдать задание»
  // (совпадает с серверным гейтом POST /api/assignments во всех режимах).
  const paywallMode = await getPaywallMode();

  return NextResponse.json({
    members: members.map((m) => ({
      memberId: m.id,
      userId: m.userId,
      role: m.role,
      joinedAt: m.joinedAt,
      firstName: m.user.firstName,
      lastName: m.user.lastName,
      position: m.user.profile?.position ?? null,
      number: m.user.profile?.number ?? null,
      avatarUrl: m.user.profile?.avatarUrl ?? null,
      potential: m.user.profile?.potential ?? 0,
      hasPremium: hasPremium(m.user),
      // задание можно давать только подписчикам (п.6g). true → в пикере дизейбл.
      subscriptionBlocked: isPaywalled(m.user, paywallMode),
      assignmentStatus: statusByAthlete.get(m.userId) ?? 'none',
    })),
  });
}
