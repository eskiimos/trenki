import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireCoach, requireTeamOwnership } from '@/lib/coach/guards';
import { generateInviteCode } from '@/lib/coach/invite-code';

export const dynamic = 'force-dynamic';

interface RouteContext { params: Promise<{ id: string }>; }

/**
 * POST /api/teams/[id]/regenerate-code
 * Тренер генерирует новый invite-код (старый перестаёт работать).
 */
export async function POST(request: NextRequest, ctx: RouteContext) {
  const auth = await requireCoach(request);
  if ('response' in auth) return auth.response;

  const { id: teamId } = await ctx.params;
  const owns = await requireTeamOwnership(auth.user.id, teamId);
  if (!owns) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // До 5 попыток на случай коллизий
  let newCode: string | null = null;
  for (let i = 0; i < 5; i++) {
    const candidate = generateInviteCode();
    const exists = await prisma.team.findUnique({ where: { inviteCode: candidate }, select: { id: true } });
    if (!exists) { newCode = candidate; break; }
  }
  if (!newCode) return NextResponse.json({ error: 'Не удалось сгенерировать код' }, { status: 500 });

  const team = await prisma.team.update({
    where: { id: teamId },
    data: { inviteCode: newCode },
    select: { id: true, inviteCode: true },
  });

  return NextResponse.json({ team });
}
