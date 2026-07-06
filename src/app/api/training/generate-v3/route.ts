import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuthUser } from '@/lib/coach/guards';
import { getPaywallMode } from '@/lib/settings';
import { isPaywalled } from '@/lib/paywall';
import {
  TrainingGoal,
  EnergyState,
  AgeGroup,
  WorkoutStatus,
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

/**
 * АЛГОРИТМ ТРЕНЬКИ 2.0 - ГЕНЕРАЦИЯ ТРЕНИРОВОК
 * 
 * POST /api/training/generate-v3
 * 
 * Body: {
 *   goal: TrainingGoal,
 *   energyState: EnergyState,
 * }
 * Auth: httpOnly session cookie (userId берётся из неё)
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuthUser(request);
    if ('response' in auth) return auth.response;

    // Быстрая ИИ-тренировка (Трек A, п.6e): бесплатно 1 в неделю, дальше — подписка.
    // Гейтим только когда paywall активен для этого юзера (в 'off' — безлимит, как раньше;
    // премиум isPaywalled=false → безлимит). Квоту считаем по standalone-сессиям
    // (не тренерским, не микроцикл-дням, не заданиям) за последние 7 дней.
    const mode = await getPaywallMode();
    if (isPaywalled(auth.user, mode)) {
      const FREE_PER_WEEK = 1;
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const usedThisWeek = await prisma.workoutSession.count({
        where: {
          userId: auth.user.id,
          createdAt: { gte: weekAgo },
          coachId: null,
          microcycleDay: { is: null },
          assignment: { is: null },
        },
      });
      if (usedThisWeek >= FREE_PER_WEEK) {
        return NextResponse.json(
          { error: 'Subscription required', code: 'SUBSCRIPTION_REQUIRED', reason: 'weekly_quota' },
          { status: 402 },
        );
      }
    }

    const { goal, energyState } = await request.json();

    if (!goal || !energyState) {
      return NextResponse.json(
        { error: 'goal и energyState обязательны' },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: auth.user.id },
      include: { profile: true },
    });

    if (!user || !user.profile) {
      return NextResponse.json(
        {
          error: 'Профиль не найден. Пройдите онбординг.',
          redirectTo: '/onboarding/characteristics',
        },
        { status: 404 }
      );
    }

    const profile = user.profile;

    // Определяем уровень сложности на основе потенциала
    const complexityLevel = getComplexityLevel(profile.potential);
    const allowedComplexityLevels = getAllowedComplexityLevels(
      complexityLevel,
      energyState as EnergyState
    );

    console.log('📊 Уровень спортсмена:', {
      potential: profile.potential,
      complexity: complexityLevel,
      allowedLevels: allowedComplexityLevels,
    });

    // Определяем структуру тренировки (количество модулей)
    const structure = getWorkoutStructure(
      energyState as EnergyState,
      profile.potential
    );


    // Определяем диапазон RPE
    const rpeRange = getRPERange(
      energyState as EnergyState,
      profile.potential,
      profile.ageGroup as AgeGroup | undefined
    );


    // Получаем направления и типы нагрузки из матриц
    const muscleGroups = GOAL_TO_MUSCLE_GROUPS[goal as TrainingGoal];
    let loadTypes = GOAL_TO_LOAD_TYPES[goal as TrainingGoal];

    // Применяем возрастные модификаторы
    loadTypes.fitness = applyAgeModifiers(
      loadTypes.fitness,
      profile.ageGroup as AgeGroup | undefined
    );
    loadTypes.technique = applyAgeModifiers(
      loadTypes.technique,
      profile.ageGroup as AgeGroup | undefined
    );


    // Собираем тренировку
    const workout = await buildWorkout({
      userId: user.id,
      goal: goal as TrainingGoal,
      energyState: energyState as EnergyState,
      structure,
      muscleGroups,
      loadTypes,
      rpeRange,
      complexityLevels: allowedComplexityLevels,
      ageGroup: profile.ageGroup as AgeGroup | undefined,
    });

    if (!workout.modules || workout.modules.length === 0) {
      return NextResponse.json(
        {
          error: 'Не найдены подходящие модули для тренировки',
          suggestion: 'Попробуйте другую цель или добавьте больше контента',
          missingModules: workout.missingModules,
        },
        { status: 404 }
      );
    }

    // Сохраняем тренировку в БД
    const workoutSession = await prisma.workoutSession.create({
      data: {
        userId: user.id,
        targetDuration: workout.totalDuration / 60, // в минутах
        targetRPE: (rpeRange.min + rpeRange.max) / 2,
        loadDirection: 'MEDIUM', // можно убрать или сделать опциональным
        status: WorkoutStatus.PENDING,
        totalVideos: workout.modules.length,
        currentVideoIndex: 0,
        videos: {
          create: workout.modules.map((module: any, index: number) => ({
            videoId: module.id,
            order: index,
            completed: false,
          })),
        },
      },
    });

    // Обновляем lastGoals в профиле (п.11 - отслеживание разнообразия)
    const previousGoals = profile.lastGoals || [];
    const lastGoals = [goal, ...previousGoals].slice(0, 3);
    await prisma.profile.update({
      where: { id: profile.id },
      data: { lastGoals },
    });

    const isRepeatedGoal =
      previousGoals.length >= 2 &&
      previousGoals.slice(0, 2).every((g) => g === goal);


    return NextResponse.json({
      success: true,
      workoutId: workoutSession.id,
      workout: {
        id: workoutSession.id,
        ...workout,
      },
      meta: {
        goal,
        energyState,
        complexity: complexityLevel,
        rpeRange,
        structure,
        diversityWarning: isRepeatedGoal
          ? 'Вы выбирали одну и ту же цель последние 3 тренировки. Попробуйте смежную цель для баланса.'
          : null,
      },
    });
  } catch (error: any) {
    console.error('❌ Ошибка генерации тренировки:', error);
    return NextResponse.json(
      {
        error: 'Не удалось сгенерировать тренировку',
      },
      { status: 500 }
    );
  }
}

// buildWorkout и formatModule вынесены в @/lib/training/build-workout
