import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuthUser } from '@/lib/coach/guards';
import {
  TrainingGoal,
  EnergyState,
  AgeGroup,
  ModuleType,
  LoadType,
  WorkoutStatus,
} from '@/generated/prisma';
import {
  GOAL_TO_MUSCLE_GROUPS,
  GOAL_TO_LOAD_TYPES,
  getRPERange,
  getWorkoutStructure,
  getWarmupLoadTypes,
  applyAgeModifiers,
  getComplexityLevel,
  getAllowedComplexityLevels,
  matchWarmupToFitness,
} from '@/lib/training-algorithm-v3';
import {
  selectModuleWithFallback,
  createSearchCriteria,
} from '@/lib/module-selection-v3';

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

/**
 * Построение тренировки из модулей
 */
async function buildWorkout(params: {
  userId: string;
  goal: TrainingGoal;
  energyState: EnergyState;
  structure: any;
  muscleGroups: any;
  loadTypes: any;
  rpeRange: any;
  complexityLevels: any[];
  ageGroup?: AgeGroup;
}) {
  const {
    userId,
    goal,
    energyState,
    structure,
    muscleGroups,
    loadTypes,
    rpeRange,
    complexityLevels,
    ageGroup,
  } = params;

  const modules: any[] = [];
  let totalDuration = 0;
  const missingModules: string[] = [];
  const excludeVideoIds: string[] = [];

  const selectTechniqueInsteadOfFitness =
    energyState === EnergyState.TIRED && structure.includeFitness && !structure.includeTechnique
      ? Math.random() < 0.5
      : false;

  let selectedWarmup: any | null = null;
  let selectedFitness: any | null = null;
  let selectedTechnique: any | null = null;
  let selectedCooldown: any | null = null;

  // ========================================================================
  // 1. РАЗМИНКА (если нужна)
  // ========================================================================
  // ========================================================================
  // 1. ФИЗИЧЕСКАЯ ПОДГОТОВКА / ТЕХНИКА (если нужна)
  // ========================================================================
  const shouldSelectFitness = structure.includeFitness && !selectTechniqueInsteadOfFitness;
  const shouldSelectTechnique = structure.includeTechnique || selectTechniqueInsteadOfFitness;

  if (shouldSelectFitness) {

    const fitnessCriteria = createSearchCriteria(
      ModuleType.FITNESS,
      loadTypes.fitness,
      muscleGroups.fitness,
      complexityLevels,
      rpeRange,
      ageGroup
    );

    const fitnessResult = await selectModuleWithFallback(
      fitnessCriteria,
      excludeVideoIds
    );

    if (fitnessResult.video) {
      selectedFitness = formatModule(fitnessResult.video, 'FITNESS');
      excludeVideoIds.push(fitnessResult.video.id);
      totalDuration += fitnessResult.video.duration;
      console.log(
        `✅ ФИЗ ПОДГОТОВКА: ${fitnessResult.video.title} (уровень: ${fitnessResult.fallbackLevel})`
      );
    } else {
      missingModules.push('ФИЗ ПОДГОТОВКА');
    }
  }

  if (shouldSelectTechnique) {

    const techniqueCriteria = createSearchCriteria(
      ModuleType.TECHNIQUE,
      loadTypes.technique,
      muscleGroups.technique,
      complexityLevels,
      rpeRange,
      ageGroup
    );

    const techniqueResult = await selectModuleWithFallback(
      techniqueCriteria,
      excludeVideoIds
    );

    if (techniqueResult.video) {
      selectedTechnique = formatModule(techniqueResult.video, 'TECHNIQUE');
      excludeVideoIds.push(techniqueResult.video.id);
      totalDuration += techniqueResult.video.duration;
      console.log(
        `✅ ТЕХНИКА: ${techniqueResult.video.title} (уровень: ${techniqueResult.fallbackLevel})`
      );
    } else {
      missingModules.push('ТЕХНИКА');
    }
  }

  // ========================================================================
  // 2. РАЗМИНКА (если нужна) - с привязкой к ФП и цели
  // ========================================================================
  if (structure.includeWarmup) {

    const warmupLoadTypes = getWarmupLoadTypes(energyState);
    const fitnessMuscleGroup = selectedFitness?.muscleGroup;
    const warmupMuscleGroups = fitnessMuscleGroup
      ? matchWarmupToFitness(fitnessMuscleGroup)
      : muscleGroups.warmup;

    const warmupCriteria = createSearchCriteria(
      ModuleType.WARMUP,
      warmupLoadTypes,
      warmupMuscleGroups,
      complexityLevels,
      { min: 1, max: 5 }, // разминка всегда легкая
      ageGroup,
      goal // 🎯 Добавляем цель для фильтрации
    );

    const warmupResult = await selectModuleWithFallback(
      warmupCriteria,
      excludeVideoIds
    );

    if (warmupResult.video) {
      selectedWarmup = formatModule(warmupResult.video, 'WARMUP');
      excludeVideoIds.push(warmupResult.video.id);
      totalDuration += warmupResult.video.duration;
      console.log(
        `✅ РАЗМИНКА: ${warmupResult.video.title} (уровень: ${warmupResult.fallbackLevel})`
      );
    } else {
      missingModules.push('РАЗМИНКА');
    }
  }

  // ========================================================================
  // 4. ЗАМИНКА (если нужна) - фильтруем по цели
  // ========================================================================
  if (structure.includeCooldown) {

    const cooldownCriteria = createSearchCriteria(
      ModuleType.COOLDOWN,
      [LoadType.STATIC_STRETCH, LoadType.MOBILITY, LoadType.PREHAB],
      muscleGroups.cooldown,
      complexityLevels,
      { min: 1, max: 4 }, // заминка всегда легкая
      ageGroup,
      goal // 🎯 Добавляем цель для фильтрации
    );

    const cooldownResult = await selectModuleWithFallback(
      cooldownCriteria,
      excludeVideoIds
    );

    if (cooldownResult.video) {
      selectedCooldown = formatModule(cooldownResult.video, 'COOLDOWN');
      excludeVideoIds.push(cooldownResult.video.id);
      totalDuration += cooldownResult.video.duration;
      console.log(
        `✅ ЗАМИНКА: ${cooldownResult.video.title} (уровень: ${cooldownResult.fallbackLevel})`
      );
    } else {
      missingModules.push('ЗАМИНКА');
    }
  }

  if (selectedWarmup) modules.push(selectedWarmup);
  if (selectedFitness) modules.push(selectedFitness);
  if (selectedTechnique) modules.push(selectedTechnique);
  if (selectedCooldown) modules.push(selectedCooldown);

  console.log(`⏱️ Общая длительность: ${Math.floor(totalDuration / 60)} мин`);

  return {
    modules,
    totalDuration,
    missingModules,
  };
}

/**
 * Форматирование модуля для ответа
 */
function formatModule(video: any, moduleType: string) {
  return {
    id: video.id,
    title: video.title,
    description: video.description,
    duration: video.duration,
    videoUrl: video.videoUrl,
    thumbnail: video.thumbnail,
    muscleGroup: video.muscleGroup || null,
    trainer: {
      id: video.trainer.id,
      name: video.trainer.name,
      lastName: video.trainer.lastName,
      avatar: video.trainer.avatar || '/images/avatars/trainer-avatar-1.png',
    },
    moduleType,
    loadTypes: video.videoTags
      .map((vt: any) => vt.tag.loadType)
      .filter(Boolean),
  };
}
