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
import { goalsFromStoredDays } from '@/lib/microcycle/week-plan';
import { GOAL_LABELS } from '@/lib/training-algorithm-v3';

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
              videos: {
                orderBy: { order: 'asc' },
                select: { video: { select: { id: true, title: true, thumbnail: true, duration: true } } },
              },
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
      dayCount: microcycle.days.length,
    },
    new Date(),
  );

  // Короткая вводная неделя Пт-Вс закрывается БЕЗ опроса (effectiveStatus
  // ARCHIVED), но в БД остаётся status=ACTIVE/feedback=null. Не отдаём её как
  // актуальный цикл — иначе календарь рисует баннер завершённой недели.
  if (effectiveStatus === 'ARCHIVED') {
    return NextResponse.json({ microcycle: null });
  }

  // Цель (направленность) каждого дня — та же ротация, что при генерации.
  const plans = goalsFromStoredDays(
    microcycle.days.map((d) => ({ dayOfWeek: d.dayOfWeek, intent: d.intent })),
    microcycle.cycleNumber,
  );
  const goalByDay = new Map(plans.map((p) => [p.dayOfWeek, GOAL_LABELS[p.goal]?.label ?? null]));

  return NextResponse.json({
    microcycle: {
      id: microcycle.id,
      weekStartDate: microcycle.weekStartDate,
      cycleNumber: microcycle.cycleNumber,
      status: microcycle.status,
      effectiveStatus,
      awaitingFeedback: effectiveStatus === 'AWAITING_FEEDBACK',
      // Сколько тренировок недели реально выполнено. Ноль → вместо опроса
      // «как перенёс неделю» показываем поддерживающий экран (нечего оценивать).
      completedCount: microcycle.days.filter((d) => d.workoutSession?.status === 'COMPLETED').length,
      days: microcycle.days.map((d) => ({
        dayOfWeek: d.dayOfWeek,
        intent: d.intent,
        goal: goalByDay.get(d.dayOfWeek) ?? null, // направленность/цель дня
        // Модули тренировки дня с превью (id/название/картинка/длительность) —
        // чтобы календарь рисовал карточки, как в /video, а не голый список.
        modules:
          d.workoutSession?.videos.map((v) => ({
            id: v.video.id,
            title: v.video.title,
            thumbnail: v.video.thumbnail,
            duration: v.video.duration,
          })) ?? [],
        workoutSession: d.workoutSession
          ? {
              id: d.workoutSession.id,
              status: d.workoutSession.status,
              targetDuration: d.workoutSession.targetDuration,
              totalVideos: d.workoutSession.totalVideos,
              currentVideoIndex: d.workoutSession.currentVideoIndex,
            }
          : null,
      })),
    },
  });
}
