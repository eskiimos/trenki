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
  MicrocycleIntent,
  WorkoutStatus,
  MicrocycleStatus,
  MicrocycleFeedback,
} from '@/generated/prisma';
import { buildMicrocycleDayWorkout } from '@/lib/microcycle/build-day';
import {
  planWeek,
  planFirstWeek,
  standardWeekStates,
  parsePrevDay,
} from '@/lib/microcycle/week-plan';
import { getMicrocycleStartDate, getMicrocycleWeekStart } from '@/lib/microcycle/week-start';

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

  // ── Прошлый цикл (нужен и для адаптации, и для выбора даты старта) ──
  const lastCycle = await prisma.microcycle.findFirst({
    where: { userId },
    orderBy: { cycleNumber: 'desc' },
    select: {
      cycleNumber: true,
      feedback: true,
      days: { select: { dayOfWeek: true, intent: true } },
    },
  });
  const isFirstCycle = !lastCycle;

  // Дата старта: ПЕРВЫЙ цикл — с сегодня (вводная неделя по дню старта,
  // методичка «старт с разных дней»). Последующие — со следующего понедельника
  // (стандартная неделя Пн-Пт; «со след. недели всегда Пн-Пт»). Cron передаёт
  // startDate явно (ближайший Пн).
  const weekStartDate =
    opts.startDate ?? (isFirstCycle ? getMicrocycleStartDate(now) : getMicrocycleWeekStart(now));

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

  const cycleNumber = (lastCycle?.cycleNumber ?? 0) + 1;
  const prevDays =
    lastCycle && lastCycle.days.length > 0
      ? lastCycle.days.map((d) => parsePrevDay(d.dayOfWeek, d.intent))
      : null;
  const feedback: MicrocycleFeedback | null = lastCycle?.feedback ?? null;

  // ── План недели (методичка «По циклу с разных дней начало») ─────────
  // День старта (0=Вс..6=Сб). Первый цикл — вводная структура по дню старта
  // (короче, если не с понедельника). Если прошлый цикл был вводным
  // (<5 дней) — со следующей недели строим стандартную Пн-Пт (с адаптацией
  // по фидбэку, если опрос был). Иначе — обычная адаптация от прошлой недели.
  const startDow = weekStartDate.getUTCDay();
  let plan;
  if (!prevDays) {
    plan = planFirstWeek(startDow, cycleNumber);
  } else if (prevDays.length >= 5) {
    plan = planWeek(prevDays, feedback, cycleNumber);
  } else {
    plan = planWeek(standardWeekStates(), feedback, cycleNumber);
  }

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

    const workout = await buildMicrocycleDayWorkout(
      userId,
      { potential: profile.potential, ageGroup: profile.ageGroup as AgeGroup | undefined },
      { goal: goal as TrainingGoal, energyState, kind },
    );

    planned.push({
      dayOfWeek: day.dayOfWeek,
      intent,
      workoutSessionId: null,
      missingModules: workout.missingModules,
      totalDuration: workout.totalDuration,
      moduleCount: workout.modules.length,
      rpeAvg: workout.rpeAvg,
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
