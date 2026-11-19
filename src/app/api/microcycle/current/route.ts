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
import { getEffectiveStatus } from '@/lib/microcycle/status';
import { macrocycleWeekLabel, missingMacrocycleModules, storedDayPlans } from '@/lib/microcycle/stored-plan';
import { GOAL_LABELS } from '@/lib/training-algorithm-v3';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await requireAuthUser(request);
  if ('response' in auth) return auth.response;

  // Only the newest cycle may prompt for feedback, even after a newer week is archived.
  const microcycle = await prisma.microcycle.findFirst({
    where: { userId: auth.user.id },
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
                select: { video: { select: { id: true, title: true, thumbnail: true, duration: true, moduleType: true } } },
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

  if (effectiveStatus === 'ARCHIVED') {
    return NextResponse.json({ microcycle: null });
  }

  const goals = new Map(storedDayPlans(microcycle).map((p) => [p.dayOfWeek, p.goal]));

  return NextResponse.json({
    microcycle: {
      id: microcycle.id,
      weekStartDate: microcycle.weekStartDate,
      cycleNumber: microcycle.cycleNumber,
      macrocycleWeek: microcycle.macrocycleWeek,
      weekLabel: macrocycleWeekLabel(microcycle.macrocycleWeek),
      status: microcycle.status,
      effectiveStatus,
      awaitingFeedback: effectiveStatus === 'AWAITING_FEEDBACK',
      // Сколько тренировок недели реально выполнено. Ноль → вместо опроса
      // «как перенёс неделю» показываем поддерживающий экран (нечего оценивать).
      completedCount: microcycle.days.filter((d) => d.workoutSession?.status === 'COMPLETED').length,
      days: microcycle.days.map((d) => {
        const goal = goals.get(d.dayOfWeek);
        return {
          dayOfWeek: d.dayOfWeek,
          intent: d.intent,
          goal: goal ? GOAL_LABELS[goal]?.label ?? null : null,
          goalKey: goal ?? null,
          missingModules: missingMacrocycleModules(
            microcycle.macrocycleWeek,
            d.intent,
            d.workoutSession?.videos.map((v) => v.video.moduleType) ?? [],
          ),
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
        };
      }),
    },
  });
}
