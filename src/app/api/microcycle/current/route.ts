/**
 * GET /api/microcycle/current
 *
 * Возвращает активный микроцикл текущего юзера (если есть). Используется
 * страницей /calendar для отображения баннера и подсветки дней Пн-Пт.
 *
 * Response 200 (есть активный):
 *   { microcycle: { id, weekStartDate, cycleNumber, status,
 *                   days: [{ dayOfWeek, intent, workoutSession }] } }
 * Response 200 (нет): { microcycle: null }
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuthUser } from '@/lib/coach/guards';
import { MicrocycleStatus } from '@/generated/prisma';
import { getEffectiveStatus } from '@/lib/microcycle/status';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await requireAuthUser(request);
  if ('response' in auth) return auth.response;

  // Берём последний цикл юзера, который ещё не закрыт фидбэком. То есть он
  // может быть либо ACTIVE (неделя идёт), либо COMPLETED по дате но без
  // фидбэка — для второго случая UI покажет модалку «Как перенёс?».
  const microcycle = await prisma.microcycle.findFirst({
    where: {
      userId: auth.user.id,
      status: { not: MicrocycleStatus.ARCHIVED },
      feedback: null,
    },
    orderBy: { cycleNumber: 'desc' },
    include: {
      days: {
        orderBy: { dayOfWeek: 'asc' },
        include: {
          workoutSession: {
            select: {
              id: true,
              status: true,
              targetDuration: true,
              totalVideos: true,
              currentVideoIndex: true,
            },
          },
        },
      },
    },
  });

  if (!microcycle) {
    return NextResponse.json({ microcycle: null });
  }

  const effectiveStatus = getEffectiveStatus(
    {
      status: microcycle.status,
      weekStartDate: microcycle.weekStartDate,
      feedback: microcycle.feedback,
    },
    new Date(),
  );

  return NextResponse.json({
    microcycle: {
      id: microcycle.id,
      weekStartDate: microcycle.weekStartDate,
      cycleNumber: microcycle.cycleNumber,
      status: microcycle.status,
      effectiveStatus,
      awaitingFeedback: effectiveStatus === 'AWAITING_FEEDBACK',
      days: microcycle.days.map((d) => ({
        dayOfWeek: d.dayOfWeek,
        intent: d.intent,
        workoutSession: d.workoutSession,
      })),
    },
  });
}
