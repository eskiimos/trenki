import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireCoach, requireTeamOwnership } from '@/lib/coach/guards';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string; memberId: string }>;
}

/**
 * POST /api/teams/[id]/members/[memberId]/reject
 * Тренер отклоняет заявку — PENDING → DECLINED. Игроку push не шлём,
 * чтобы не показывать стыдное; он просто не получит подтверждения.
 */
export async function POST(request: NextRequest, ctx: RouteContext) {
  const auth = await requireCoach(request);
  if ('response' in auth) return auth.response;

  const { id: teamId, memberId } = await ctx.params;
  const owns = await requireTeamOwnership(auth.user.id, teamId);
  if (!owns) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const member = await prisma.teamMember.findUnique({
    where: { id: memberId },
    select: { id: true, teamId: true, status: true },
  });
  if (!member || member.teamId !== teamId) {
    return NextResponse.json({ error: 'Заявка не найдена' }, { status: 404 });
  }
  if (member.status === 'ACTIVE') {
    return NextResponse.json(
      { error: 'Этот игрок уже в команде' },
      { status: 400 },
    );
  }

  await prisma.teamMember.update({
    where: { id: memberId },
    data: { status: 'DECLINED' },
  });

  return NextResponse.json({ success: true });
}
