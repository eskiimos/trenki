import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireCoach } from '@/lib/coach/guards';

export const dynamic = 'force-dynamic';

interface RouteContext { params: Promise<{ id: string }>; }

/**
 * GET /api/athletes/[id]/coach-view
 * Возвращает данные игрока для просмотра тренером.
 * Доступно только тренеру, в чьей команде состоит игрок.
 */
export async function GET(request: NextRequest, ctx: RouteContext) {
  const auth = await requireCoach(request);
  if ('response' in auth) return auth.response;

  const { id: athleteId } = await ctx.params;

  // Проверяем что игрок состоит в одной из команд тренера
  const membership = await prisma.teamMember.findFirst({
    where: {
      userId: athleteId,
      status: 'ACTIVE',
      team: { createdBy: auth.user.id },
    },
    select: { teamId: true },
  });
  if (!membership) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const athlete = await prisma.user.findUnique({
    where: { id: athleteId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      profile: true,
    },
  });
  if (!athlete) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Последние задания этого игрока от текущего тренера
  const assignments = await prisma.trainingAssignment.findMany({
    where: { athleteId, coachId: auth.user.id },
    orderBy: { assignedAt: 'desc' },
    take: 20,
    include: {
      video: { select: { id: true, title: true, thumbnail: true, duration: true } },
    },
  });

  // Прирост характеристик за последние 10 событий — для подписей +N.N
  // в PotentialSection. То же, что показывается атлету в /profile.
  const recentHistory = await prisma.characteristicHistory.findMany({
    where: {
      userId: athleteId,
      OR: [
        { gainPower: { not: 0 } },
        { gainSpeed: { not: 0 } },
        { gainEndurance: { not: 0 } },
        { gainTechnique: { not: 0 } },
        { gainFlexibility: { not: 0 } },
      ],
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: {
      gainPower: true,
      gainSpeed: true,
      gainEndurance: true,
      gainTechnique: true,
      gainFlexibility: true,
    },
  });
  const recentGains = recentHistory.reduce(
    (acc, e) => ({
      gainPower:       acc.gainPower       + e.gainPower,
      gainSpeed:       acc.gainSpeed       + e.gainSpeed,
      gainEndurance:   acc.gainEndurance   + e.gainEndurance,
      gainTechnique:   acc.gainTechnique   + e.gainTechnique,
      gainFlexibility: acc.gainFlexibility + e.gainFlexibility,
    }),
    {
      gainPower: 0,
      gainSpeed: 0,
      gainEndurance: 0,
      gainTechnique: 0,
      gainFlexibility: 0,
    },
  );

  return NextResponse.json({ athlete, assignments, recentGains });
}
