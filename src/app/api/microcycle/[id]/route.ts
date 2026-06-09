/**
 * GET /api/microcycle/[id]
 *
 * Полная информация о цикле для экрана результатов: дни + сессии +
 * агрегированная статистика (сколько завершено, общий прирост потенциала).
 *
 * Auth: httpOnly session cookie. Доступ только владельцу.
 *
 * Response 200: { microcycle, stats }
 * Response 403/404 — как обычно.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuthUser } from '@/lib/coach/guards';
import { WorkoutStatus } from '@/generated/prisma';
import { getEffectiveStatus } from '@/lib/microcycle/status';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuthUser(request);
  if ('response' in auth) return auth.response;

  const { id } = await params;

  const cycle = await prisma.microcycle.findUnique({
    where: { id },
    include: {
      days: {
        orderBy: { dayOfWeek: 'asc' },
        include: {
          workoutSession: {
            select: {
              id: true,
              status: true,
              targetDuration: true,
              actualDuration: true,
              totalVideos: true,
              currentVideoIndex: true,
              startedAt: true,
              completedAt: true,
            },
          },
        },
      },
    },
  });

  if (!cycle) {
    return NextResponse.json({ error: 'Микроцикл не найден' }, { status: 404 });
  }
  if (cycle.userId !== auth.user.id) {
    return NextResponse.json({ error: 'Доступ запрещён' }, { status: 403 });
  }

  // ── Статистика по сессиям цикла ────────────────────────────────────
  const sessionIds = cycle.days
    .map((d) => d.workoutSession?.id)
    .filter((id): id is string => !!id);

  const completedCount = cycle.days.filter(
    (d) => d.workoutSession?.status === WorkoutStatus.COMPLETED,
  ).length;
  const inProgressCount = cycle.days.filter(
    (d) => d.workoutSession?.status === WorkoutStatus.IN_PROGRESS,
  ).length;
  const plannedCount = cycle.days.filter((d) => !!d.workoutSession).length;

  // ── Прирост потенциала за период цикла ─────────────────────────────
  // Берём все CharacteristicHistory, привязанные к сессиям цикла, и суммируем
  // их gain*. Это honest-метрика — учитывает только то, что атлет реально
  // выполнил (CharacteristicHistory создаётся в /api/training/complete).
  let totalGain = {
    potential: 0,
    power: 0,
    speed: 0,
    endurance: 0,
    technique: 0,
    flexibility: 0,
  };

  if (sessionIds.length > 0) {
    const histories = await prisma.characteristicHistory.findMany({
      where: { sessionId: { in: sessionIds } },
      select: {
        gainPower: true,
        gainSpeed: true,
        gainEndurance: true,
        gainTechnique: true,
        gainFlexibility: true,
      },
    });

    for (const h of histories) {
      totalGain.power += h.gainPower;
      totalGain.speed += h.gainSpeed;
      totalGain.endurance += h.gainEndurance;
      totalGain.technique += h.gainTechnique;
      totalGain.flexibility += h.gainFlexibility;
    }
    // Потенциал — среднее 5 характеристик, прирост ему равен среднему
    // приростов. Это приблизительно, точная формула — в /api/training/complete.
    totalGain.potential =
      (totalGain.power +
        totalGain.speed +
        totalGain.endurance +
        totalGain.technique +
        totalGain.flexibility) /
      5;
  }

  const effectiveStatus = getEffectiveStatus(
    {
      status: cycle.status,
      weekStartDate: cycle.weekStartDate,
      feedback: cycle.feedback,
    },
    new Date(),
  );

  return NextResponse.json({
    microcycle: {
      id: cycle.id,
      weekStartDate: cycle.weekStartDate,
      cycleNumber: cycle.cycleNumber,
      status: cycle.status,
      effectiveStatus,
      feedback: cycle.feedback,
      days: cycle.days.map((d) => ({
        dayOfWeek: d.dayOfWeek,
        intent: d.intent,
        workoutSession: d.workoutSession,
      })),
    },
    stats: {
      plannedCount,
      completedCount,
      inProgressCount,
      skippedCount: 5 - plannedCount, // дни, для которых AI не нашёл модулей
      totalGain,
    },
  });
}
