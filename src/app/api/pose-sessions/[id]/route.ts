import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireCoach } from '@/lib/coach/guards';

export const dynamic = 'force-dynamic';

/**
 * PATCH /api/pose-sessions/[id]
 * Тренер ставит оценку и комментарий к сессии трекинга движений атлета.
 * Body: { rating: 1..5, comment?: string }
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireCoach(request);
  if ('response' in auth) return auth.response;

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

  const rating = Number(body.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ error: 'rating must be integer 1..5' }, { status: 400 });
  }
  const comment = typeof body.comment === 'string' ? body.comment.slice(0, 1000) : null;

  const existing = await prisma.poseSession.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const updated = await prisma.poseSession.update({
    where: { id },
    data: {
      coachId: auth.user.id,
      coachRating: rating,
      coachComment: comment ?? undefined,
      reviewedAt: new Date(),
    },
  });

  return NextResponse.json({ ok: true, session: updated });
}
