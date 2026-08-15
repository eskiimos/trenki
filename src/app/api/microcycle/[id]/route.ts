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
import { getEffectiveStatus, isIntroWeekNoSurvey } from '@/lib/microcycle/status';

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
  const completedCount = cycle.days.filter(
    (d) => d.workoutSession?.status === WorkoutStatus.COMPLETED,
  ).length;
  const inProgressCount = cycle.days.filter(
    (d) => d.workoutSession?.status === WorkoutStatus.IN_PROGRESS,
  ).length;
  // Досрочный финиш (Sprint 2): день сделан не полностью, но сделан.
  const partialCount = cycle.days.filter(
    (d) => d.workoutSession?.status === WorkoutStatus.PARTIAL,
  ).length;
  const plannedCount = cycle.days.filter((d) => !!d.workoutSession).length;

  // ── Прирост потенциала за НЕДЕЛЮ цикла ─────────────────────────────
  // Считаем по ОКНУ ВРЕМЕНИ, а не по привязке к сессиям цикла.
  //
  // Почему: привязка `sessionId ∈ сессии цикла` теряла почти весь прирост.
  //  · День цикла можно закрыть быстрой тренировкой — /api/microcycle/close-day
  //    ставит сессии дня COMPLETED без начисления, а прирост уходит на сессию
  //    быстрой, которая к циклу не привязана.
  //  · Отдельные модули (/api/training/complete-module) пишут историю вообще
  //    без sessionId, когда модуль запущен не из сессии.
  // В итоге экран показывал «выполнено 2 из 5» и «прирост 0.0» одновременно.
  // Заголовок карточки — «прирост за неделю», поэтому окно и есть честная база.
  //
  // Границы окна: [начало недели цикла; +7 дней), но не залезая на следующий
  // цикл — иначе прирост посчитался бы дважды в двух отчётах.
  const windowStart = new Date(cycle.weekStartDate);
  const windowEnd = new Date(windowStart);
  windowEnd.setDate(windowEnd.getDate() + 7);

  const nextCycle = await prisma.microcycle.findFirst({
    where: { userId: cycle.userId, weekStartDate: { gt: cycle.weekStartDate } },
    orderBy: { weekStartDate: 'asc' },
    select: { weekStartDate: true },
  });
  if (nextCycle && nextCycle.weekStartDate < windowEnd) {
    windowEnd.setTime(nextCycle.weekStartDate.getTime());
  }

  const totalGain = {
    potential: 0,
    power: 0,
    speed: 0,
    endurance: 0,
    technique: 0,
    flexibility: 0,
  };

  const histories = await prisma.characteristicHistory.findMany({
    where: {
      userId: cycle.userId,
      createdAt: { gte: windowStart, lt: windowEnd },
    },
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
  // Потенциал — среднее 5 характеристик, прирост ему равен среднему приростов.
  totalGain.potential =
    (totalGain.power +
      totalGain.speed +
      totalGain.endurance +
      totalGain.technique +
      totalGain.flexibility) /
    5;

  const effectiveStatus = getEffectiveStatus(
    {
      status: cycle.status,
      weekStartDate: cycle.weekStartDate,
      feedback: cycle.feedback,
      dayCount: cycle.days.length,
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
      // Короткий вводный заход Пт-Вс (без опроса) — для текста «со след. недели полный цикл».
      introNoSurvey: isIntroWeekNoSurvey(cycle.weekStartDate, cycle.days.length),
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
      partialCount,
      skippedCount: cycle.days.length - plannedCount, // дни, для которых AI не нашёл модулей
      totalGain,
      // Прирост посчитан за окно недели, а не по сессиям цикла — экран об этом
      // пишет, чтобы цифра не выглядела «взявшейся ниоткуда».
      gainWindow: { from: windowStart.toISOString(), to: windowEnd.toISOString() },
    },
  });
}
