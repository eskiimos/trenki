import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuthUser } from '@/lib/coach/guards';

export const dynamic = 'force-dynamic';

interface RouteContext { params: Promise<{ id: string }>; }

/**
 * DELETE /api/teams/[id]/leave
 * Атлет выходит из команды. Идемпотентно: если членства нет — просто success.
 */
export async function DELETE(request: NextRequest, ctx: RouteContext) {
  const auth = await requireAuthUser(request);
  if ('response' in auth) return auth.response;

  const { id: teamId } = await ctx.params;
  await prisma.teamMember.deleteMany({
    where: { teamId, userId: auth.user.id },
  });

  return NextResponse.json({ success: true });
}
