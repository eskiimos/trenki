import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireCoach, requireTeamOwnership } from '@/lib/coach/guards';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/teams/[id]/stats
 * Возвращает агрегированную статистику команды:
 *   - кол-во игроков
 *   - средний потенциал
 *   - кол-во заданий за неделю и выполнено из них
 */
export async function GET(request: NextRequest, ctx: RouteContext) {
  const auth = await requireCoach(request);
  if ('response' in auth) return auth.response;

  const { id: teamId } = await ctx.params;
  const owns = await requireTeamOwnership(auth.user.id, teamId);
  if (!owns) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Активные члены и их потенциал
  const activeMembers = await prisma.teamMember.findMany({
    where: { teamId, status: 'ACTIVE' },
    select: {
      user: { select: { profile: { select: { potential: true } } } },
    },
  });

  const membersCount = activeMembers.length;
  const potentials = activeMembers
    .map((m) => m.user.profile?.potential ?? 0)
    .filter((p) => p > 0);
  const averagePotential = potentials.length === 0
    ? 0
    : potentials.reduce((s, p) => s + p, 0) / potentials.length;

  // Задания за последние 7 дней
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekAssignments = await prisma.trainingAssignment.findMany({
    where: { teamId, assignedAt: { gte: weekAgo } },
    select: { status: true },
  });
  const totalWeek = weekAssignments.length;
  const completedWeek = weekAssignments.filter((a) => a.status === 'COMPLETED').length;

  return NextResponse.json({
    membersCount,
    averagePotential: Math.round(averagePotential * 10) / 10,
    totalWeek,
    completedWeek,
  });
}
