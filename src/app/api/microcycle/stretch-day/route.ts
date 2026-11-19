import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { editableMacrocycleSlots, loadMacrocycleEdit, lockMacrocycleEdit } from '@/lib/microcycle/macrocycle-edit';
import { selectMacrocycleVideos } from '@/lib/microcycle/macrocycle-selection';
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
    select: { id: true, workoutSessionId: true, microcycle: { select: { macrocycleWeek: true } } },
  });
  if (!day || !day.workoutSessionId) {
    return NextResponse.json({ error: 'День раскисления не найден' }, { status: 404 });
  }

  if (day.microcycle.macrocycleWeek != null) {
    const result = await prisma.$transaction(async tx => {
      await lockMacrocycleEdit(tx, userId);
      const edit = await loadMacrocycleEdit(tx, userId, sessionId);
      if (!edit || edit.intent !== 'STRETCH') {
        return { error: 'День раскисления уже изменился.', status: 409 } as const;
      }
      const slots = editableMacrocycleSlots(edit.phase, edit.intent, bodyPart);
      const picked = selectMacrocycleVideos(slots, edit.catalog, edit.potential, { usedIds: edit.usedIds });
      const modules = picked.filter(v => v !== null);
      if (modules.length !== slots.length) {
        return { error: 'Пока не хватает подходящих видео для разминки и растяжки на эту часть тела.', status: 422 } as const;
      }
      // Claim only an unstarted session. A failed rebuild keeps its previous modules and direction.
      const claimed = await tx.workoutSession.updateMany({
        where: { id: sessionId, status: 'PENDING' },
        data: {
          totalVideos: modules.length,
          targetDuration: Math.round(modules.reduce((sum, v) => sum + v.duration, 0) / 60),
        },
      });
      if (!claimed.count) return { error: 'Эта тренировка уже началась.', status: 409 } as const;
      await tx.workoutSessionVideo.deleteMany({ where: { sessionId } });
      await tx.workoutSessionVideo.createMany({
        data: modules.map((v, order) => ({ sessionId, videoId: v.id, order })),
      });
      await tx.microcycleDay.update({ where: { id: edit.dayId }, data: { stretchBodyPart: bodyPart } });
      return { moduleCount: modules.length } as const;
    });
    if (result.error) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ ok: true, sessionId, bodyPart, moduleCount: result.moduleCount });
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
