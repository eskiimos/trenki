/**
 * PATCH /api/microcycle/[id]/feedback
 *
 * Атлет отвечает на опрос «как перенёс неделю?» — закрывает цикл.
 * Тот же endpoint можно использовать, чтобы перезаписать ответ (юзер
 * передумал и ткнул другую кнопку до закрытия модалки).
 *
 * Body: { feedback: 'EASY' | 'NORMAL' | 'HARD' }
 * Auth: httpOnly session cookie.
 *
 * Response 200: { microcycle: { id, feedback, status } }
 * Response 403: цикл принадлежит другому юзеру
 * Response 404: цикл не найден
 * Response 400: невалидный feedback
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuthUser } from '@/lib/coach/guards';
import { MicrocycleFeedback, MicrocycleStatus } from '@/generated/prisma';
import { getEffectiveStatus } from '@/lib/microcycle/status';

export const dynamic = 'force-dynamic';

const VALID_FEEDBACK = new Set<MicrocycleFeedback>([
  MicrocycleFeedback.EASY,
  MicrocycleFeedback.NORMAL,
  MicrocycleFeedback.HARD,
]);

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuthUser(request);
  if ('response' in auth) return auth.response;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const feedback = body?.feedback as MicrocycleFeedback | undefined;

  if (!feedback || !VALID_FEEDBACK.has(feedback)) {
    return NextResponse.json(
      { error: 'feedback должен быть EASY, NORMAL или HARD' },
      { status: 400 },
    );
  }

  const cycle = await prisma.microcycle.findUnique({
    where: { id },
    select: { id: true, userId: true, weekStartDate: true, days: { select: { id: true } } },
  });

  if (!cycle) {
    return NextResponse.json({ error: 'Микроцикл не найден' }, { status: 404 });
  }

  if (cycle.userId !== auth.user.id) {
    return NextResponse.json({ error: 'Доступ запрещён' }, { status: 403 });
  }

  // Принимаем фидбэк только если цикл ЗАВЕРШЁН по дате. Считаем статус по дате
  // (status=ACTIVE, feedback=null) — это позволяет перезаписать ответ, пока
  // модалка открыта, но не даёт: (а) закрыть ещё активный цикл преждевременно,
  // (б) поставить фидбэк короткой вводной неделе Пт-Вс (она без опроса).
  const byDate = getEffectiveStatus(
    { status: MicrocycleStatus.ACTIVE, weekStartDate: cycle.weekStartDate, feedback: null, dayCount: cycle.days.length },
    new Date(),
  );
  if (byDate === 'ACTIVE') {
    return NextResponse.json({ error: 'Цикл ещё не завершён' }, { status: 409 });
  }
  if (byDate === 'ARCHIVED') {
    return NextResponse.json({ error: 'Этот цикл без опроса (короткая вводная неделя)' }, { status: 409 });
  }

  const updated = await prisma.microcycle.update({
    where: { id },
    data: {
      feedback,
      status: MicrocycleStatus.ARCHIVED,
    },
    select: { id: true, feedback: true, status: true },
  });

  return NextResponse.json({ microcycle: updated });
}
