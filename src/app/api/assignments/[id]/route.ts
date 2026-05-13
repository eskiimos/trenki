import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireCoach } from '@/lib/coach/guards';

export const dynamic = 'force-dynamic';

interface RouteContext { params: Promise<{ id: string }>; }

/**
 * DELETE /api/assignments/[id]
 * Тренер удаляет/отменяет назначенное им задание (если ещё не выполнено).
 */
export async function DELETE(request: NextRequest, ctx: RouteContext) {
  const auth = await requireCoach(request);
  if ('response' in auth) return auth.response;

  const { id } = await ctx.params;
  const assignment = await prisma.trainingAssignment.findUnique({ where: { id } });
  if (!assignment) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (assignment.coachId !== auth.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await prisma.trainingAssignment.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
