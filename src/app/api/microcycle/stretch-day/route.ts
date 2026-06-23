import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuthUser } from '@/lib/coach/guards';
import {
  TrainingGoal,
  EnergyState,
  AgeGroup,
  WorkoutStatus,
} from '@/generated/prisma';
import {
  buildMicrocycleDayWorkout,
  stretchMuscleOverride,
  isBodyPart,
} from '@/lib/microcycle/build-day';

// POST /api/microcycle/stretch-day — пересобрать день «раскисление» под
// выбранную атлетом часть тела (низ/верх/всё). Методичка: «в день раскисление
// дать выбрать на какую часть тела делать растяжку».
// Body: { sessionId: string, bodyPart: 'lower'|'upper'|'full' }
export async function POST(request: NextRequest) {
  const auth = await requireAuthUser(request);
  if ('response' in auth) return auth.response;
  const userId = auth.user.id;

  const body = await request.json().catch(() => ({}));
  const sessionId = String(body?.sessionId || '').trim();
  const bodyPart = body?.bodyPart;
  if (!sessionId || !isBodyPart(bodyPart)) {
    return NextResponse.json({ error: 'sessionId и корректный bodyPart обязательны' }, { status: 400 });
  }

  // Проверяем, что сессия — это день «раскисление» (STRETCH) ИМЕННО этого юзера
  // (через microcycle.userId) — защита от чужих сессий.
  const day = await prisma.microcycleDay.findFirst({
    where: { workoutSessionId: sessionId, intent: 'STRETCH', microcycle: { userId } },
    select: { id: true, workoutSessionId: true },
  });
  if (!day || !day.workoutSessionId) {
    return NextResponse.json({ error: 'День раскисления не найден' }, { status: 404 });
  }

  const profile = await prisma.profile.findUnique({
    where: { userId },
    select: { potential: true, ageGroup: true },
  });
  if (!profile) {
    return NextResponse.json({ error: 'Профиль не найден' }, { status: 400 });
  }

  // Пересобираем разминку+растяжку под выбранную часть тела.
  const workout = await buildMicrocycleDayWorkout(
    userId,
    { potential: profile.potential, ageGroup: profile.ageGroup as AgeGroup | undefined },
    { goal: TrainingGoal.SPORT_LONGEVITY, energyState: EnergyState.IN_TONE, kind: 'WARMUP_STRETCH' },
    stretchMuscleOverride(bodyPart),
  );

  if (workout.modules.length === 0) {
    // Не нашлось видео под эту часть тела — не затираем сессию.
    return NextResponse.json(
      { error: 'Пока нет видео-растяжки для этой части тела. Попробуй другую.' },
      { status: 422 },
    );
  }

  // Заменяем видео сессии и сбрасываем прогресс (день пересобран).
  await prisma.$transaction(async (tx) => {
    await tx.workoutSessionVideo.deleteMany({ where: { sessionId } });
    await tx.workoutSession.update({
      where: { id: sessionId },
      data: {
        status: WorkoutStatus.PENDING,
        currentVideoIndex: 0,
        totalVideos: workout.modules.length,
        targetDuration: Math.round(workout.totalDuration / 60),
        targetRPE: workout.rpeAvg,
        videos: {
          create: workout.modules.map((m, i) => ({ videoId: m.id, order: i, completed: false })),
        },
      },
    });
  });

  return NextResponse.json({ ok: true, sessionId, bodyPart, moduleCount: workout.modules.length });
}
