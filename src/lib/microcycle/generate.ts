// Чистая функция генерации микроцикла для одного юзера. Используется
// и эндпоинтом POST /api/microcycle/generate (по запросу атлета), и cron'ом
// /api/cron/microcycle-autogenerate (массово в воскресенье вечером).
//
// Неделя строится по методичке тренеров через planWeek (week-plan.ts):
// 3 полноценных дня (Пн/Ср/Пт) + Вт «только разминка» + Чт «разминка+растяжка»,
// с адаптацией состояний от фидбэка прошлого цикла и ротацией целей.

import { prisma } from '@/lib/prisma';
import {
  AgeGroup,
  TrainingGoal,
  EnergyState,
  MicrocycleIntent,
  WorkoutStatus,
  MicrocycleStatus,
  MicrocycleFeedback,
} from '@/generated/prisma';
import {
  GOAL_TO_MUSCLE_GROUPS,
  GOAL_TO_LOAD_TYPES,
  getRPERange,
  getWorkoutStructure,
  applyAgeModifiers,
  getComplexityLevel,
  getAllowedComplexityLevels,
  type WorkoutStructure,
} from '@/lib/training-algorithm-v3';
import { buildWorkout } from '@/lib/training/build-workout';
import { planWeek, parsePrevDay, type DayKind } from '@/lib/microcycle/week-plan';
import { getMicrocycleStartDate } from '@/lib/microcycle/week-start';

export type GenerateStatus = 'CREATED' | 'EXISTING' | 'NO_PROFILE';

export interface GeneratedDay {
  dayOfWeek: number;
  intent: MicrocycleIntent;
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
  /** Явная стартовая дата (00:00 UTC). По умолчанию — сегодня. Cron шлёт Пн. */
  startDate?: Date;
}

// Структура тренировки по типу дня. Полный — стандартная v3-структура;
// лёгкие дни урезаны (только разминка / разминка+заминка-растяжка).
function structureForKind(
  kind: DayKind,
  energyState: EnergyState,
  potential: number,
): WorkoutStructure {
  if (kind === 'WARMUP') {
    return {
      moduleCount: 1,
      includeWarmup: true,
      includeFitness: false,
      includeTechnique: false,
      includeCooldown: false,
    };
  }
  if (kind === 'WARMUP_STRETCH') {
    return {
      moduleCount: 2,
      includeWarmup: true,
      includeFitness: false,
      includeTechnique: false,
      includeCooldown: true, // заминка = статическая растяжка/мобилити
    };
  }
  return getWorkoutStructure(energyState, potential);
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

  // ── Прошлый цикл → состояния дней + фидбэк для адаптации ────────────
  const lastCycle = await prisma.microcycle.findFirst({
    where: { userId },
    orderBy: { cycleNumber: 'desc' },
    select: {
      cycleNumber: true,
      feedback: true,
      days: { select: { dayOfWeek: true, intent: true } },
    },
  });
  const cycleNumber = (lastCycle?.cycleNumber ?? 0) + 1;
  const prevDays =
    lastCycle && lastCycle.days.length > 0
      ? lastCycle.days.map((d) => parsePrevDay(d.dayOfWeek, d.intent))
      : null;
  const feedback: MicrocycleFeedback | null = lastCycle?.feedback ?? null;

  // План недели по методичке (структура + цели).
  const plan = planWeek(prevDays, feedback, cycleNumber);

  // adjustmentFactor — для аналитики (как именно адаптировали).
  const adjustmentFactor =
    feedback === MicrocycleFeedback.EASY ? 1 : feedback === MicrocycleFeedback.HARD ? -1 : 0;

  // ── Генерация тренировок по дням (последовательно) ─────────────────
  type PlannedDay = {
    dayOfWeek: number;
    intent: MicrocycleIntent;
    workoutSessionId: string | null;
    missingModules: string[];
    totalDuration: number;
    moduleCount: number;
    rpeAvg: number;
    modules: Array<{ id: string }>;
  };
  const planned: PlannedDay[] = [];

  for (const day of plan) {
    const { goal, energyState, kind, intent } = day;

    const complexityLevel = getComplexityLevel(profile.potential);
    const allowedComplexityLevels = getAllowedComplexityLevels(complexityLevel, energyState);
    const structure = structureForKind(kind, energyState, profile.potential);
    const rpeRange = getRPERange(
      energyState,
      profile.potential,
      profile.ageGroup as AgeGroup | undefined,
    );
    const muscleGroups = GOAL_TO_MUSCLE_GROUPS[goal as TrainingGoal];
    // Клонируем — applyAgeModifiers возвращает новый массив, и без клона мы бы
    // мутировали общую константу GOAL_TO_LOAD_TYPES (порча между днями/юзерами,
    // особенно в cron'е, который гонит всех юзеров в одном процессе).
    const baseLoad = GOAL_TO_LOAD_TYPES[goal as TrainingGoal];
    const loadTypes = {
      ...baseLoad,
      fitness: applyAgeModifiers(baseLoad.fitness, profile.ageGroup as AgeGroup | undefined),
      technique: applyAgeModifiers(baseLoad.technique, profile.ageGroup as AgeGroup | undefined),
    };

    const workout = await buildWorkout({
      userId,
      goal: goal as TrainingGoal,
      energyState,
      structure,
      muscleGroups,
      loadTypes,
      rpeRange,
      complexityLevels: allowedComplexityLevels,
      ageGroup: profile.ageGroup as AgeGroup | undefined,
    });

    planned.push({
      dayOfWeek: day.dayOfWeek,
      intent,
      workoutSessionId: null,
      missingModules: workout.missingModules,
      totalDuration: workout.totalDuration,
      moduleCount: workout.modules.length,
      rpeAvg: Math.round((rpeRange.min + rpeRange.max) / 2),
      modules: workout.modules,
    });
  }

  // ── Сохраняем в одной транзакции ───────────────────────────────────
  let cycleId: string;
  try {
    cycleId = await prisma.$transaction(async (tx) => {
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
  } catch (e: any) {
    // Гонка: цикл на эту неделю создан параллельно (cron + ручной запрос) →
    // unique violation по (userId, weekStartDate). Возвращаем существующий
    // вместо 500.
    if (e?.code === 'P2002') {
      const raced = await prisma.microcycle.findUnique({
        where: { userId_weekStartDate: { userId, weekStartDate } },
        include: { days: { orderBy: { dayOfWeek: 'asc' } } },
      });
      if (raced) {
        return {
          status: 'EXISTING',
          microcycleId: raced.id,
          weekStartDate: raced.weekStartDate,
          cycleNumber: raced.cycleNumber,
          days: raced.days.map((d) => ({
            dayOfWeek: d.dayOfWeek,
            intent: d.intent,
            workoutSessionId: d.workoutSessionId,
            moduleCount: 0,
            missingModules: [],
          })),
        };
      }
    }
    throw e;
  }

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
