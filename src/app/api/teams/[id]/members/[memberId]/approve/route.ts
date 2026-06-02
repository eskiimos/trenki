import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireCoach, requireTeamOwnership } from '@/lib/coach/guards';
import { sendUserPush } from '@/lib/coach/push';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string; memberId: string }>;
}

/**
 * POST /api/teams/[id]/members/[memberId]/approve
 * Тренер подтверждает заявку игрока — PENDING → ACTIVE. Игроку уходит push.
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
    include: {
      team: { select: { id: true, name: true } },
      user: { select: { id: true } },
    },
  });
  if (!member || member.teamId !== teamId) {
    return NextResponse.json({ error: 'Заявка не найдена' }, { status: 404 });
  }
  if (member.status === 'ACTIVE') {
    return NextResponse.json({ success: true, alreadyActive: true });
  }

  const updated = await prisma.teamMember.update({
    where: { id: memberId },
    data: { status: 'ACTIVE', joinedAt: new Date() },
  });

  sendUserPush(member.user.id, {
    title: 'Тебя приняли в команду',
    body: `Тренер подтвердил заявку в «${member.team.name}»`,
    url: '/profile/assignments',
  }).catch(() => {});

  return NextResponse.json({ success: true, member: updated });
}
