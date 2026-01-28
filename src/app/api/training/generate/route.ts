import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { LoadDirection, WorkoutStatus, LoadType, MuscleGroup, TrainingGoal, ModuleType } from '@/generated/prisma';
import { ensureDevUser } from '@/lib/dev-user';
import { updateUserActivity } from '@/lib/updateUserActivity';

/**
 * POST /api/training/generate
 * Генерирует персональную тренировку согласно алгоритму «Треньки» (с)
 * 
 * АЛГОРИТМ:
 * п.2 - ФИЗ ПОДГОТОВКА как стержневой модуль
 * п.5 - Учет состояния (восстановление/развитие/пик)
 * п.8 - Совместимость ТЕХНИКИ с ФИЗ ПОДГОТОВКОЙ
 * п.9-10 - Совместимость РАЗМИНКИ со статусом и ФИЗ
 * п.11 - Совместимость ЗАМИНКИ с направлением ФИЗ
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, assessmentId } = body;

    if (!userId) {
      return NextResponse.json(
        { error: 'userId обязателен' },
        { status: 400 }
      );
    }
    
    await ensureDevUser(userId);

    // Обновляем активность пользователя
    await updateUserActivity(userId);

    // Получаем последнюю оценку состояния
    let assessment;
    if (assessmentId) {
      assessment = await prisma.userStateAssessment.findUnique({
        where: { id: assessmentId },
      });
    } else {
      assessment = await prisma.userStateAssessment.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });
    }

    if (!assessment) {
      return NextResponse.json(
        { error: 'Оценка состояния не найдена. Сначала пройдите опрос.' },
        { status: 404 }
      );
    }

    // Получаем историю последних выполненных видео (предотвращение повторов)
    const recentWorkouts = await prisma.workoutSession.findMany({
      where: {
        userId,
        createdAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        },
      },
      include: {
        videos: {
          select: { videoId: true },
        },
      },
    });

    const recentVideoIds = recentWorkouts.flatMap(w => w.videos.map(v => v.videoId));

    // Подбираем видео по новому алгоритму
    const result = await selectModulesForWorkoutV2(
      assessment,
      recentVideoIds
    );

    if (!result.success) {
      return NextResponse.json(
        { 
          error: 'Недостаточно видео для генерации тренировки',
          message: result.message,
          noVideos: true,
          missingModules: result.missingModules
        },
        { status: 404 }
      );
    }

    const selectedVideos = result.videos!;
    
    // Рассчитываем общую длительность в секундах
    const totalDuration = selectedVideos.reduce((sum, v) => sum + v.duration, 0);

    // Создаём тренировку в БД
    const workoutSession = await prisma.workoutSession.create({
      data: {
        userId,
        assessmentId: assessment.id,
        targetDuration: assessment.availableTime,
        targetRPE: assessment.recommendedRPE,
        loadDirection: assessment.loadDirection,
        status: WorkoutStatus.PENDING,
        totalVideos: selectedVideos.length,
        currentVideoIndex: 0,
        videos: {
          create: selectedVideos.map((video, index) => ({
            videoId: video.id,
            order: index,
            completed: false,
          })),
        },
      },
      include: {
        videos: {
          include: {
            video: {
              include: {
                trainer: true,
              },
            },
          },
          orderBy: { order: 'asc' },
        },
      },
    });

    console.log('✅ Workout session created:', workoutSession.id);

    return NextResponse.json({
      success: true,
      workout: {
        id: workoutSession.id,
        targetDuration: assessment.availableTime,
        actualDuration: Math.round(totalDuration / 60), // в минутах
        targetRPE: assessment.recommendedRPE,
        loadDirection: assessment.loadDirection,
        status: workoutSession.status,
        modulesCount: selectedVideos.length,
        modules: workoutSession.videos.map((wsVideo) => ({
          id: wsVideo.video.id,
          title: wsVideo.video.title,
          description: wsVideo.video.description,
          moduleType: wsVideo.video.category || null,
          loadType: wsVideo.video.difficulty || null,
          duration: wsVideo.video.duration,
          rpeRange: `${wsVideo.video.rpeMin}-${wsVideo.video.rpeMax}`,
          videoUrl: wsVideo.video.videoUrl,
          thumbnail: wsVideo.video.thumbnail,
          trainer: {
            id: wsVideo.video.trainer.id,
            name: wsVideo.video.trainer.name,
            lastName: wsVideo.video.trainer.lastName,
          },
          order: wsVideo.order,
          completed: wsVideo.completed,
        })),
      },
    });
  } catch (error) {
    console.error('Ошибка генерации тренировки:', error);
    return NextResponse.json(
      { error: 'Ошибка сервера' },
      { status: 500 }
    );
  }
}

/**
 * Подбор видео для тренировки
 * Упрощённая версия: подбираем по типу модуля и RPE
 */
async function selectModulesForWorkout(
  loadDirection: LoadDirection,
  targetRPE: number,
  availableTime: number,
  excludeModuleIds: string[],
  assessment?: any
): Promise<{ videos: any[]; missingModules: string[] }> {
  const videos: any[] = [];
  const missingModules: string[] = [];

  // Определяем статус тренировки из assessment
  const trainingStatus = getTrainingStatus(assessment);
  
  console.log('🎯 Selecting videos:', { loadDirection, targetRPE, trainingStatus });

  // ШАГ 1: Подбираем РАЗМИНКУ (любое видео с низким RPE)
  const warmup = await prisma.video.findFirst({
    where: {
      isPublished: true,
      id: { notIn: excludeModuleIds },
      rpeMax: { lte: 5 }, // разминка всегда легкая
      category: { in: ['GENERAL', 'TECHNIQUE', 'SKATING'] }, // подходящие для разминки
    },
    include: {
      trainer: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  if (warmup) {
    videos.push(warmup);
    console.log('✅ Selected WARMUP:', {
      title: warmup.title,
      category: warmup.category,
      difficulty: warmup.difficulty,
    });
  } else {
    missingModules.push('РАЗМИНКА');
    console.log('❌ WARMUP (Разминка) не найдена! Требуется: категории GENERAL/TECHNIQUE/SKATING с RPE макс ≤ 5');
  }

  // ШАГ 2: Подбираем ОФП (основной модуль - силовые или выносливость)
  const fitness = await prisma.video.findFirst({
    where: {
      isPublished: true,
      category: { in: ['STRENGTH', 'ENDURANCE', 'POWER_PLAY'] }, // ОФП категории
      id: { 
        notIn: [
          ...excludeModuleIds,
          ...(warmup ? [warmup.id] : []),
        ] 
      },
      rpeMin: { lte: targetRPE + 2 },
      rpeMax: { gte: targetRPE - 2 },
    },
    include: {
      trainer: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  if (fitness) {
    videos.push(fitness);
    console.log('✅ Selected FITNESS:', {
      title: fitness.title,
      category: fitness.category,
      difficulty: fitness.difficulty,
    });
  } else {
    missingModules.push('ОФП');
    console.log('❌ FITNESS (ОФП) не найдена! Требуется: категории STRENGTH/ENDURANCE/POWER_PLAY с RPE в диапазоне', targetRPE - 2, '-', targetRPE + 2);
  }

    // ШАГ 3: Подбираем ТЕХНИКУ
  const technique = await prisma.video.findFirst({
    where: {
      isPublished: true,
      category: { in: ['TECHNIQUE', 'SKATING', 'SHOOTING', 'PASSING', 'CHECKING'] }, // Технические категории
      id: { 
        notIn: [
          ...excludeModuleIds,
          ...videos.map((v) => v.id),
        ] 
      },
      rpeMin: { lte: targetRPE + 2 },
      rpeMax: { gte: targetRPE - 2 },
    },
    include: {
      trainer: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  if (technique) {
    videos.push(technique);
    console.log('✅ Selected TECHNIQUE:', {
      title: technique.title,
      category: technique.category,
      difficulty: technique.difficulty,
    });
  } else {
    missingModules.push('ТЕХНИКА');
    console.log('❌ TECHNIQUE (Техника) не найдена! Требуется: категории TECHNIQUE/SKATING/SHOOTING/PASSING/CHECKING с RPE в диапазоне', targetRPE - 2, '-', targetRPE + 2);
  }

  // ШАГ 4: Подбираем ЗАМИНКУ (легкое видео для завершения)
  const cooldown = await prisma.video.findFirst({
    where: {
      isPublished: true,
      category: { in: ['GENERAL', 'TECHNIQUE'] }, // Легкие категории для заминки
      id: {
        notIn: [
          ...excludeModuleIds,
          ...videos.map((v) => v.id),
        ],
      },
      rpeMax: { lte: 5 }, // заминка легкая (до 5 RPE)
    },
    include: {
      trainer: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  if (cooldown) {
    videos.push(cooldown);
    console.log('✅ Selected COOLDOWN:', {
      title: cooldown.title,
      category: cooldown.category,
      difficulty: cooldown.difficulty,
    });
  } else {
    missingModules.push('ЗАМИНКА');
    console.log('❌ COOLDOWN (Заминка) не найдена! Требуется: категории GENERAL/TECHNIQUE с RPE макс ≤ 5');
  }

  console.log(`📊 Итого подобрано видео: ${videos.length}/4`);
  if (missingModules.length > 0) {
    console.log(`⚠️ Отсутствуют модули: ${missingModules.join(', ')}`);
  }
  
  return { videos, missingModules };
}

/**
 * Определяет статус тренировки из assessment
 */
function getTrainingStatus(assessment?: any): 'RECOVERY' | 'DEVELOPMENT' | 'PEAK' {
  if (!assessment) {
    return 'DEVELOPMENT'; // по умолчанию
  }

  // Используем формулу из п.5
  let freshnessCoefficient = 1;
  switch (assessment.lastTrainingTime) {
    case 'TODAY':
      freshnessCoefficient = 1;
      break;
    case 'YESTERDAY':
      freshnessCoefficient = 2;
      break;
    case 'TWO_DAYS_AGO':
    case 'THREE_PLUS_DAYS':
      freshnessCoefficient = 3;
      break;
    case 'WEEK_PLUS':
      freshnessCoefficient = 1;
      break;
  }

  const readinessLevel = freshnessCoefficient + assessment.energyLevel;

  if (readinessLevel >= 2 && readinessLevel <= 6) {
    return 'RECOVERY';
  } else if (readinessLevel >= 7 && readinessLevel <= 10) {
    return 'DEVELOPMENT';
  } else {
    return 'PEAK';
  }
}

/**
 * НОВАЯ ФУНКЦИЯ: Подбор видео согласно алгоритму «Треньки» (с)
 * п.2 - ФИЗ ПОДГОТОВКА как стержень, остальные подбираются под неё
 */
async function selectModulesForWorkoutV2(
  assessment: any,
  excludeVideoIds: string[]
): Promise<{
  success: boolean;
  videos?: any[];
  message?: string;
  missingModules?: string[];
  trainingStatus?: TrainingGoal;
}> {
  const videos: any[] = [];
  const missingModules: string[] = [];
  const targetRPE = assessment.recommendedRPE;
  
  // ШАГ 1: Определяем статус тренировки (п.5)
  const trainingStatus = getTrainingStatusEnum(assessment);
  console.log('🎯 Статус:', trainingStatus, 'RPE:', targetRPE);

  // ШАГ 2: СТЕРЖНЕВОЙ МОДУЛЬ - ФИЗ ПОДГОТОВКА (п.2, п.5)
  const fitnessLoadTypes = getFitnessLoadTypesByStatus(trainingStatus);
  
  const fitness = await prisma.video.findFirst({
    where: {
      isPublished: true,
      id: { notIn: excludeVideoIds },
      moduleType: ModuleType.FITNESS,
      loadType: { in: fitnessLoadTypes },
      trainingGoals: { has: trainingStatus },
      // RPE временно игнорируем - полагаемся на loadType
    },
    include: { trainer: true },
    orderBy: { createdAt: 'desc' },
  });

  if (!fitness) {
    missingModules.push(`ФИЗ ПОДГОТОВКА (${trainingStatus})`);
    console.log('❌ FITNESS не найдена! Статус:', trainingStatus, 'Типы нагрузки:', fitnessLoadTypes);
    return {
      success: false,
      message: `Не найден модуль ФИЗ ПОДГОТОВКА для статуса ${trainingStatus}`,
      missingModules,
      trainingStatus,
    };
  }

  videos.push(fitness);
  console.log('✅ FITNESS:', fitness.title, 'LoadType:', fitness.loadType, 'MuscleGroup:', fitness.muscleGroup);

  // ШАГ 3: ТЕХНИКА - совместимая с ФИЗ ПОДГОТОВКОЙ (п.8)
  const techniqueLoadTypes = getCompatibleTechniqueTypes(fitness.loadType!);
  const canTechniqueBeFullBody = fitness.muscleGroup !== MuscleGroup.LOWER_BODY;
  
  const technique = await prisma.video.findFirst({
    where: {
      isPublished: true,
      id: { notIn: [...excludeVideoIds, fitness.id] },
      moduleType: ModuleType.TECHNIQUE,
      loadType: { in: techniqueLoadTypes },
      ...(canTechniqueBeFullBody ? {} : { 
        OR: [
          { muscleGroup: { not: MuscleGroup.FULL_BODY } },
          { muscleGroup: null }
        ]
      }),
      // RPE временно игнорируем
    },
    include: { trainer: true },
    orderBy: { createdAt: 'desc' },
  });

  if (!technique) {
    missingModules.push('ТЕХНИКА');
    console.log('❌ TECHNIQUE не найдена! Совместимые типы:', techniqueLoadTypes);
  } else {
    videos.push(technique);
    console.log('✅ TECHNIQUE:', technique.title, 'LoadType:', technique.loadType);
  }

  // ШАГ 4: РАЗМИНКА - по статусу + совместимость с ФИЗ (п.9-10)
  const warmupTypes = getWarmupTypesByStatus(trainingStatus, fitness.loadType!);
  const warmupMuscleGroups = getWarmupMuscleGroups(fitness.muscleGroup);
  
  const warmup = await prisma.video.findFirst({
    where: {
      isPublished: true,
      id: { notIn: [...excludeVideoIds, fitness.id, ...(technique ? [technique.id] : [])] },
      moduleType: ModuleType.WARMUP,
      loadType: { in: warmupTypes },
      ...(warmupMuscleGroups.length > 0 ? { 
        OR: [
          { muscleGroup: { in: warmupMuscleGroups } },
          { muscleGroup: null }
        ]
      } : {}),
      // RPE не используем - разминка всегда легкая по loadType (DYNAMIC_STRETCH)
    },
    include: { trainer: true },
    orderBy: { createdAt: 'desc' },
  });

  if (!warmup) {
    missingModules.push('РАЗМИНКА');
    console.log('❌ WARMUP не найдена! Типы:', warmupTypes, 'Группы:', warmupMuscleGroups);
  } else {
    videos.unshift(warmup); // Разминка идёт первой
    console.log('✅ WARMUP:', warmup.title, 'LoadType:', warmup.loadType);
  }

  // ШАГ 5: ЗАМИНКА - по направлению ФИЗ ПОДГОТОВКИ (п.11)
  const cooldownMuscleGroups = getCooldownMuscleGroups(fitness.muscleGroup);
  
  const cooldown = await prisma.video.findFirst({
    where: {
      isPublished: true,
      id: { notIn: videos.map(v => v.id).concat(excludeVideoIds) },
      moduleType: ModuleType.COOLDOWN,
      ...(cooldownMuscleGroups.length > 0 ? {
        OR: [
          { muscleGroup: { in: cooldownMuscleGroups } },
          { muscleGroup: null }
        ]
      } : {}),
      // RPE не используем - заминка всегда легкая по loadType (STATIC_STRETCH)
    },
    include: { trainer: true },
    orderBy: { createdAt: 'desc' },
  });

  if (!cooldown) {
    missingModules.push('ЗАМИНКА');
    console.log('❌ COOLDOWN не найдена! Группы:', cooldownMuscleGroups);
  } else {
    videos.push(cooldown); // Заминка идёт последней
    console.log('✅ COOLDOWN:', cooldown.title, 'MuscleGroup:', cooldown.muscleGroup);
  }

  // Проверяем минимальные требования (хотя бы ФИЗ + еще один модуль)
  if (videos.length < 2) {
    return {
      success: false,
      message: 'Недостаточно видео для создания тренировки (минимум 2 модуля)',
      missingModules,
      trainingStatus,
    };
  }

  console.log(`📊 Итого: ${videos.length}/4 модулей`);
  return { success: true, videos, trainingStatus };
}

/**
 * п.5: Определяет статус тренировки (возвращает enum)
 */
function getTrainingStatusEnum(assessment: any): TrainingGoal {
  let freshnessCoeff = 1;
  switch (assessment.lastTrainingTime) {
    case 'WEEK_PLUS':
    case 'TODAY':
      freshnessCoeff = 1;
      break;
    case 'YESTERDAY':
      freshnessCoeff = 2;
      break;
    case 'TWO_DAYS_AGO':
    case 'THREE_PLUS_DAYS':
      freshnessCoeff = 3;
      break;
  }

  const readinessLevel = freshnessCoeff + assessment.energyLevel;

  if (readinessLevel >= 2 && readinessLevel <= 6) {
    return TrainingGoal.SPORT_LONGEVITY;
  } else if (readinessLevel >= 7 && readinessLevel <= 10) {
    return TrainingGoal.FULL_GAME_ENDURANCE;
  } else {
    return TrainingGoal.POWERFUL_SHOT;
  }
}

/**
 * п.5: Типы нагрузки для ФИЗ ПОДГОТОВКИ по статусу
 */
function getFitnessLoadTypesByStatus(status: TrainingGoal): LoadType[] {
  const map: Record<TrainingGoal, LoadType[]> = {
    [TrainingGoal.SPORT_LONGEVITY]: [
      LoadType.PREHAB,
      LoadType.MOBILITY,
    ],
    [TrainingGoal.FULL_GAME_ENDURANCE]: [
      LoadType.ANAEROBIC_ENDURANCE,
      LoadType.AEROBIC_ENDURANCE,
      LoadType.AGILITY,
      LoadType.SPEED,
    ],
    [TrainingGoal.POWERFUL_SHOT]: [
      LoadType.MAX_STRENGTH,
      LoadType.POWER,
      LoadType.SPEED,
      LoadType.ANAEROBIC_ENDURANCE,
    ],
    // Остальные цели - сбалансированный подход
    [TrainingGoal.OUTRUN_OPPONENT]: [LoadType.SPEED, LoadType.AGILITY],
    [TrainingGoal.STRENGTH_STABILITY]: [LoadType.MAX_STRENGTH, LoadType.POWER],
    [TrainingGoal.SOFT_HANDS]: [LoadType.AGILITY],
    [TrainingGoal.AGILITY]: [LoadType.AGILITY, LoadType.SPEED],
  };
  return map[status] || [LoadType.AEROBIC_ENDURANCE];
}

/**
 * п.8: Совместимость ТЕХНИКИ с типом нагрузки ФИЗ ПОДГОТОВКИ
 */
function getCompatibleTechniqueTypes(fitnessType: LoadType): LoadType[] {
  const map: Record<LoadType, LoadType[]> = {
    [LoadType.MAX_STRENGTH]: [LoadType.POWER, LoadType.AGILITY, LoadType.ANAEROBIC_ENDURANCE, LoadType.TECHNICAL_SKILL],
    [LoadType.SPEED]: [LoadType.AGILITY, LoadType.ANAEROBIC_ENDURANCE, LoadType.TECHNICAL_SKILL],
    [LoadType.ANAEROBIC_ENDURANCE]: [LoadType.SPEED, LoadType.AGILITY, LoadType.POWER, LoadType.TECHNICAL_SKILL],
    [LoadType.AEROBIC_ENDURANCE]: [LoadType.SPEED, LoadType.AGILITY, LoadType.POWER, LoadType.TECHNICAL_SKILL],
    [LoadType.POWER]: [LoadType.SPEED, LoadType.AGILITY, LoadType.TECHNICAL_SKILL],
    [LoadType.AGILITY]: [LoadType.ANAEROBIC_ENDURANCE, LoadType.SPEED, LoadType.POWER, LoadType.TECHNICAL_SKILL],
    [LoadType.MOBILITY]: [LoadType.AGILITY, LoadType.TECHNICAL_SKILL],
    [LoadType.PREHAB]: [LoadType.TECHNICAL_SKILL],
    [LoadType.TECHNICAL_SKILL]: [LoadType.TECHNICAL_SKILL],
    [LoadType.STRENGTH_ENDURANCE]: [LoadType.AGILITY, LoadType.TECHNICAL_SKILL],
    [LoadType.STATIC_STRETCH]: [LoadType.TECHNICAL_SKILL],
    [LoadType.DYNAMIC_STRETCH]: [LoadType.TECHNICAL_SKILL],
  };
  return map[fitnessType] || [LoadType.TECHNICAL_SKILL];
}

/**
 * п.9-10: Типы РАЗМИНКИ по статусу и типу ФИЗ ПОДГОТОВКИ
 */
function getWarmupTypesByStatus(status: TrainingGoal, fitnessType: LoadType): LoadType[] {
  if (status === TrainingGoal.SPORT_LONGEVITY) {
    return [LoadType.DYNAMIC_STRETCH];
  }

  const intensiveTypes: LoadType[] = [LoadType.MAX_STRENGTH, LoadType.POWER, LoadType.SPEED];
  if (intensiveTypes.includes(fitnessType)) {
    return [LoadType.AGILITY, LoadType.DYNAMIC_STRETCH];
  }

  return [LoadType.DYNAMIC_STRETCH];
}

/**
 * п.10: Направление мышц для РАЗМИНКИ по ФИЗ ПОДГОТОВКЕ
 */
function getWarmupMuscleGroups(fitnessMuscleGroup: MuscleGroup | null): MuscleGroup[] {
  if (!fitnessMuscleGroup) return [MuscleGroup.FULL_BODY];
  
  const map: Record<MuscleGroup, MuscleGroup[]> = {
    [MuscleGroup.FULL_BODY]: [MuscleGroup.FULL_BODY],
    [MuscleGroup.LOWER_BODY]: [MuscleGroup.FULL_BODY, MuscleGroup.LOWER_BODY],
    [MuscleGroup.UPPER_PUSH]: [MuscleGroup.UPPER_PUSH, MuscleGroup.FULL_BODY],
    [MuscleGroup.UPPER_PULL]: [MuscleGroup.UPPER_PULL, MuscleGroup.FULL_BODY],
    [MuscleGroup.CORE_STABILITY]: [MuscleGroup.FULL_BODY],
    [MuscleGroup.CORE_DYNAMICS]: [MuscleGroup.FULL_BODY],
    [MuscleGroup.PREHAB_KNEE]: [MuscleGroup.LOWER_BODY, MuscleGroup.FULL_BODY],
    [MuscleGroup.PREHAB_SHOULDER]: [MuscleGroup.FULL_BODY],
    [MuscleGroup.PREHAB_BACK]: [MuscleGroup.FULL_BODY],
  };
  return map[fitnessMuscleGroup] || [MuscleGroup.FULL_BODY];
}

/**
 * п.11: Направление мышц для ЗАМИНКИ по ФИЗ ПОДГОТОВКЕ
 */
function getCooldownMuscleGroups(fitnessMuscleGroup: MuscleGroup | null): MuscleGroup[] {
  if (!fitnessMuscleGroup) return [MuscleGroup.FULL_BODY];
  
  const map: Record<MuscleGroup, MuscleGroup[]> = {
    [MuscleGroup.FULL_BODY]: [MuscleGroup.FULL_BODY],
    [MuscleGroup.LOWER_BODY]: [MuscleGroup.LOWER_BODY, MuscleGroup.FULL_BODY],
    [MuscleGroup.UPPER_PUSH]: [MuscleGroup.UPPER_PUSH],
    [MuscleGroup.UPPER_PULL]: [MuscleGroup.FULL_BODY, MuscleGroup.UPPER_PULL],
    [MuscleGroup.CORE_STABILITY]: [MuscleGroup.FULL_BODY],
    [MuscleGroup.CORE_DYNAMICS]: [MuscleGroup.FULL_BODY],
    [MuscleGroup.PREHAB_KNEE]: [MuscleGroup.LOWER_BODY, MuscleGroup.FULL_BODY],
    [MuscleGroup.PREHAB_SHOULDER]: [MuscleGroup.FULL_BODY, MuscleGroup.UPPER_PUSH, MuscleGroup.UPPER_PULL],
    [MuscleGroup.PREHAB_BACK]: [MuscleGroup.FULL_BODY, MuscleGroup.UPPER_PUSH, MuscleGroup.UPPER_PULL],
  };
  return map[fitnessMuscleGroup] || [MuscleGroup.FULL_BODY];
}
