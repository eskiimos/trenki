import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuthUser } from '@/lib/coach/guards';
import { sendUserPush } from '@/lib/coach/push';

export const dynamic = 'force-dynamic';

interface RouteContext { params: Promise<{ id: string }>; }

/**
 * PATCH /api/assignments/[id]/status
 * Body: { status: 'IN_PROGRESS' | 'COMPLETED' }
 * Меняет статус задания. Только назначенный атлет может менять.
 */
export async function PATCH(request: NextRequest, ctx: RouteContext) {
  const auth = await requireAuthUser(request);
  if ('response' in auth) return auth.response;

  const { id } = await ctx.params;
  const body = await request.json().catch(() => ({}));
  const status = String(body?.status || '').toUpperCase();
  if (!['IN_PROGRESS', 'COMPLETED'].includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  const assignment = await prisma.trainingAssignment.findUnique({ where: { id } });
  if (!assignment) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (assignment.athleteId !== auth.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const updated = await prisma.trainingAssignment.update({
    where: { id },
    data: {
      status: status as 'IN_PROGRESS' | 'COMPLETED',
      completedAt: status === 'COMPLETED' ? new Date() : null,
    },
  });

  // При завершении задания — пушим тренеру
  if (status === 'COMPLETED') {
    const athleteName = `${auth.user.firstName ?? ''} ${auth.user.lastName ?? ''}`.trim() || 'Игрок';
    sendUserPush(updated.coachId, {
      title: 'Задание выполнено',
      body: `${athleteName} закрыл назначенную тренировку`,
      url: '/coach/assignments',
    }).catch(() => { });
  }

  return NextResponse.json({ assignment: updated });
}
