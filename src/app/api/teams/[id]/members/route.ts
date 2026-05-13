import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireCoach, requireTeamOwnership } from '@/lib/coach/guards';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/teams/[id]/members
 * Возвращает список членов команды с профилями и потенциалом.
 * Только владелец команды может видеть.
 */
export async function GET(request: NextRequest, ctx: RouteContext) {
  const auth = await requireCoach(request);
  if ('response' in auth) return auth.response;

  const { id: teamId } = await ctx.params;
  const owns = await requireTeamOwnership(auth.user.id, teamId);
  if (!owns) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
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
      assignmentStatus: statusByAthlete.get(m.userId) ?? 'none',
    })),
  });
}
