// Чистая функция генерации микроцикла для одного юзера. Используется
// и эндпоинтом POST /api/microcycle/generate (по запросу атлета), и cron'ом
// /api/cron/microcycle-autogenerate (массово в воскресенье вечером).
//
// Логика:
//   1. Найти/создать профиль; без него — NO_PROFILE.
//   2. Если уже есть микроцикл на эту weekStartDate — вернуть EXISTING.
//   3. Иначе: 5 раз buildWorkout с разными (goal, energyState) из intent-mapping,
//      применить adjustmentFactor из последнего фидбэка, сохранить транзакцией.

import { prisma } from '@/lib/prisma';
import {
  AgeGroup,
  TrainingGoal,
  EnergyState,
  WorkoutStatus,
  MicrocycleStatus,
} from '@/generated/prisma';
import {
  GOAL_TO_MUSCLE_GROUPS,
  GOAL_TO_LOAD_TYPES,
  getRPERange,
  getWorkoutStructure,
  applyAgeModifiers,
  getComplexityLevel,
  getAllowedComplexityLevels,
} from '@/lib/training-algorithm-v3';
import { buildWorkout } from '@/lib/training/build-workout';
import {
  INTENT_PARAMS,
  MICROCYCLE_DAYS_ORDER,
  applyAdjustment,
  feedbackToFactor,
} from '@/lib/microcycle/intents';
import { getMicrocycleStartDate } from '@/lib/microcycle/week-start';

export type GenerateStatus = 'CREATED' | 'EXISTING' | 'NO_PROFILE';

export interface GeneratedDay {
  dayOfWeek: number;
  intent: typeof MICROCYCLE_DAYS_ORDER[number];
  workoutSessionId: string | null;
  moduleCount: number;
  missingModules: string[];
}

export interface GenerateResult {
  status: GenerateStatus;
  microcycleId?: string;
  weekStartDate?: Date;
  cycleNumber?: number;
  days?: GeneratedDay[];
}

interface Options {
  /** Подменяемое «сейчас» — для cron'а можно явно передать (тестируемость) */
  now?: Date;
  /**
   * Явная стартовая дата (00:00 UTC). Если не передана — берётся «сегодня»
   * (getMicrocycleStartDate). Cron передаёт сюда понедельник (getMicrocycleWeekStart),
   * чтобы автоциклы шли по неделям; ручной запуск использует today.
   */
  startDate?: Date;
}

export async function generateMicrocycleForUser(
  userId: string,
  opts: Options = {},
): Promise<GenerateResult> {
  const now = opts.now ?? new Date();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { profile: true },
  });
  if (!user || !user.profile) {
    return { status: 'NO_PROFILE' };
  }

  const profile = user.profile;
  const weekStartDate = opts.startDate ?? getMicrocycleStartDate(now);

  // ── Идемпотентность ────────────────────────────────────────────────
  const existing = await prisma.microcycle.findUnique({
    where: { userId_weekStartDate: { userId, weekStartDate } },
    include: { days: { orderBy: { dayOfWeek: 'asc' } } },
  });
  if (existing) {
    return {
      status: 'EXISTING',
      microcycleId: existing.id,
      weekStartDate: existing.weekStartDate,
      cycleNumber: existing.cycleNumber,
      days: existing.days.map((d) => ({
        dayOfWeek: d.dayOfWeek,
        intent: d.intent,
        workoutSessionId: d.workoutSessionId,
        moduleCount: 0,
        missingModules: [],
      })),
    };
  }

  // ── Адаптация на основе фидбэка прошлого цикла ─────────────────────
  const lastCycle = await prisma.microcycle.findFirst({
    where: { userId },
    orderBy: { cycleNumber: 'desc' },
    select: { cycleNumber: true, feedback: true },
  });
  const cycleNumber = (lastCycle?.cycleNumber ?? 0) + 1;
  const adjustmentFactor = lastCycle?.feedback
    ? feedbackToFactor(lastCycle.feedback)
    : null;

  // ── Генерация 5 тренировок (последовательно) ───────────────────────
  type PlannedDay = {
    dayOfWeek: number;
    intent: typeof MICROCYCLE_DAYS_ORDER[number];
    goal: TrainingGoal;
    energyState: EnergyState;
    workoutSessionId: string | null;
    missingModules: string[];
    totalDuration: number;
    moduleCount: number;
    rpeAvg: number;
    modules: Array<{ id: string }>;
  };
  const planned: PlannedDay[] = [];

  for (const intent of MICROCYCLE_DAYS_ORDER) {
    const baseParams = INTENT_PARAMS[intent];
    const { goal, energyState } = applyAdjustment(baseParams, adjustmentFactor);

    const complexityLevel = getComplexityLevel(profile.potential);
    const allowedComplexityLevels = getAllowedComplexityLevels(complexityLevel, energyState);
    const structure = getWorkoutStructure(energyState, profile.potential);
    const rpeRange = getRPERange(
      energyState,
      profile.potential,
      profile.ageGroup as AgeGroup | undefined,
    );
    const muscleGroups = GOAL_TO_MUSCLE_GROUPS[goal];
    const loadTypes = GOAL_TO_LOAD_TYPES[goal];
    loadTypes.fitness = applyAgeModifiers(
      loadTypes.fitness,
      profile.ageGroup as AgeGroup | undefined,
    );
    loadTypes.technique = applyAgeModifiers(
      loadTypes.technique,
      profile.ageGroup as AgeGroup | undefined,
    );

    const workout = await buildWorkout({
      userId,
      goal,
      energyState,
      structure,
      muscleGroups,
      loadTypes,
      rpeRange,
      complexityLevels: allowedComplexityLevels,
      ageGroup: profile.ageGroup as AgeGroup | undefined,
    });

    planned.push({
      dayOfWeek: baseParams.dayOfWeek,
      intent,
      goal,
      energyState,
      workoutSessionId: null,
      missingModules: workout.missingModules,
      totalDuration: workout.totalDuration,
      moduleCount: workout.modules.length,
      rpeAvg: Math.round((rpeRange.min + rpeRange.max) / 2),
      modules: workout.modules,
    });
  }

  // ── Сохраняем в одной транзакции ───────────────────────────────────
  const cycleId = await prisma.$transaction(async (tx) => {
    const cycle = await tx.microcycle.create({
      data: {
        userId,
        weekStartDate,
        cycleNumber,
        status: MicrocycleStatus.ACTIVE,
        adjustmentFactor,
      },
    });

    for (const day of planned) {
      let workoutSessionId: string | null = null;
      if (day.modules.length > 0) {
        const session = await tx.workoutSession.create({
          data: {
            userId,
            targetDuration: Math.round(day.totalDuration / 60),
            targetRPE: day.rpeAvg,
            loadDirection: 'MEDIUM',
            status: WorkoutStatus.PENDING,
            totalVideos: day.modules.length,
            currentVideoIndex: 0,
            videos: {
              create: day.modules.map((m, i) => ({
                videoId: m.id,
                order: i,
                completed: false,
              })),
            },
          },
        });
        workoutSessionId = session.id;
      }

      await tx.microcycleDay.create({
        data: {
          microcycleId: cycle.id,
          dayOfWeek: day.dayOfWeek,
          intent: day.intent,
          workoutSessionId,
        },
      });

      day.workoutSessionId = workoutSessionId;
    }

    return cycle.id;
  }, { timeout: 30_000 });

  return {
    status: 'CREATED',
    microcycleId: cycleId,
    weekStartDate,
    cycleNumber,
    days: planned.map((d) => ({
      dayOfWeek: d.dayOfWeek,
      intent: d.intent,
      workoutSessionId: d.workoutSessionId,
      moduleCount: d.moduleCount,
      missingModules: d.missingModules,
    })),
  };
}
