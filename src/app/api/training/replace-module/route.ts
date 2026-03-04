import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  ModuleType,
  LoadType,
  MuscleGroup,
  ComplexityLevel,
  TrainingGoal,
} from '@/generated/prisma';
import {
  getComplexityLevel,
  getAllowedComplexityLevels,
  GOAL_TO_MUSCLE_GROUPS,
  GOAL_TO_LOAD_TYPES,
  getWarmupLoadTypes,
  matchWarmupToFitness,
  applyAgeModifiers,
} from '@/lib/training-algorithm-v3';
import {
  selectModuleWithFallback,
  createSearchCriteria,
} from '@/lib/module-selection-v3';

/**
 * POST /api/training/replace-module
 * 
 * Заменяет модуль в тренировке на другой подходящий
 * Body: {
 *   workoutSessionId: string,
 *   moduleIndex: number (0-3),
 *   userId: string (для валидации)
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const { workoutSessionId, moduleIndex, userId } = await request.json();

    if (!workoutSessionId || moduleIndex === undefined || !userId) {
      return NextResponse.json(
        { error: 'workoutSessionId, moduleIndex и userId обязательны' },
        { status: 400 }
      );
    }

    console.log(`🔄 Замена модуля ${moduleIndex} в тренировке ${workoutSessionId}`);

    // Получаем тренировку
    const workoutSession = await prisma.workoutSession.findUnique({
      where: { id: workoutSessionId },
      include: {
        videos: {
          include: {
            video: {
              include: {
                trainer: true,
                videoTags: {
                  include: {
                    tag: true,
                  },
                },
              },
            },
          },
          orderBy: { order: 'asc' },
        },
        user: {
          include: {
            profile: true,
          },
        },
      },
    });

    if (!workoutSession) {
      return NextResponse.json(
        { error: 'Тренировка не найдена' },
        { status: 404 }
      );
    }

    // Проверяем владельца
    if (workoutSession.userId !== userId) {
      return NextResponse.json(
        { error: 'Доступ запрещен' },
        { status: 403 }
      );
    }

    // Получаем индекс модуля (если он вне границ)
    if (moduleIndex < 0 || moduleIndex >= workoutSession.videos.length) {
      return NextResponse.json(
        { error: 'Неправильный индекс модуля' },
        { status: 400 }
      );
    }

    const currentVideo = workoutSession.videos[moduleIndex];
    const profile = workoutSession.user.profile;
    const currentModuleType = currentVideo.video.moduleType;

    // Определяем уровень сложности и RPE диапазон
    const complexityLevel = getComplexityLevel(profile!.potential);
    const allowedComplexityLevels = getAllowedComplexityLevels(
      complexityLevel,
      workoutSession.energyState as any
    );

    // Получаем информацию о тренировке из метаданных (если есть)
    const trainingGoal = (workoutSession as any).goal as TrainingGoal | null;
    const energyState = workoutSession.energyState;

    console.log('📋 Текущий модуль:', currentModuleType);

    let newModule: any = null;

    // Подбираем новый модуль того же типа
    if (currentModuleType === ModuleType.WARMUP) {
      const warmupLoadTypes = getWarmupLoadTypes(energyState as any);
      // Берем направления разминки из матрицы или используем все тело
      const muscleGroups = trainingGoal
        ? GOAL_TO_MUSCLE_GROUPS[trainingGoal]?.warmup || [MuscleGroup.FULL_BODY]
        : [MuscleGroup.FULL_BODY];

      const criteria = createSearchCriteria(
        ModuleType.WARMUP,
        warmupLoadTypes,
        muscleGroups,
        allowedComplexityLevels,
        { min: 1, max: 5 },
        profile?.ageGroup as any,
        trainingGoal
      );

      const result = await selectModuleWithFallback(
        criteria,
        [currentVideo.videoId, ...workoutSession.videos.map(v => v.videoId)] // Исключаем текущий и все используемые
      );

      if (result.video) {
        newModule = result.video;
      }
    } else if (currentModuleType === ModuleType.COOLDOWN) {
      // Заминка
      const muscleGroups = trainingGoal
        ? GOAL_TO_MUSCLE_GROUPS[trainingGoal]?.cooldown || [MuscleGroup.FULL_BODY]
        : [MuscleGroup.FULL_BODY];

      const criteria = createSearchCriteria(
        ModuleType.COOLDOWN,
        [LoadType.STATIC_STRETCH, LoadType.MOBILITY, LoadType.PREHAB],
        muscleGroups,
        allowedComplexityLevels,
        { min: 1, max: 4 },
        profile?.ageGroup as any,
        trainingGoal
      );

      const result = await selectModuleWithFallback(
        criteria,
        [currentVideo.videoId, ...workoutSession.videos.map(v => v.videoId)]
      );

      if (result.video) {
        newModule = result.video;
      }
    } else if (currentModuleType === ModuleType.FITNESS) {
      // ОФП
      let loadTypes = trainingGoal
        ? GOAL_TO_LOAD_TYPES[trainingGoal].fitness
        : [LoadType.POWER];

      loadTypes = applyAgeModifiers(
        loadTypes,
        profile?.ageGroup as any
      );

      const muscleGroups = trainingGoal
        ? GOAL_TO_MUSCLE_GROUPS[trainingGoal]?.fitness || [MuscleGroup.FULL_BODY]
        : [MuscleGroup.FULL_BODY];

      const rpeMin = Math.max(3, complexityLevel === ComplexityLevel.BEGINNER ? 3 : 4);
      const rpeMax = complexityLevel === ComplexityLevel.PRO ? 8 : 7;

      const criteria = createSearchCriteria(
        ModuleType.FITNESS,
        loadTypes,
        muscleGroups,
        allowedComplexityLevels,
        { min: rpeMin, max: rpeMax },
        profile?.ageGroup as any
      );

      const result = await selectModuleWithFallback(
        criteria,
        [currentVideo.videoId, ...workoutSession.videos.map(v => v.videoId)]
      );

      if (result.video) {
        newModule = result.video;
      }
    } else if (currentModuleType === ModuleType.TECHNIQUE) {
      // Техника
      let loadTypes = trainingGoal
        ? GOAL_TO_LOAD_TYPES[trainingGoal].technique
        : [LoadType.TECHNIQUE];

      loadTypes = applyAgeModifiers(
        loadTypes,
        profile?.ageGroup as any
      );

      const muscleGroups = trainingGoal
        ? GOAL_TO_MUSCLE_GROUPS[trainingGoal]?.technique || [MuscleGroup.FULL_BODY]
        : [MuscleGroup.FULL_BODY];

      const rpeMin = Math.max(2, complexityLevel === ComplexityLevel.BEGINNER ? 2 : 3);
      const rpeMax = complexityLevel === ComplexityLevel.PRO ? 7 : 6;

      const criteria = createSearchCriteria(
        ModuleType.TECHNIQUE,
        loadTypes,
        muscleGroups,
        allowedComplexityLevels,
        { min: rpeMin, max: rpeMax },
        profile?.ageGroup as any
      );

      const result = await selectModuleWithFallback(
        criteria,
        [currentVideo.videoId, ...workoutSession.videos.map(v => v.videoId)]
      );

      if (result.video) {
        newModule = result.video;
      }
    }

    if (!newModule) {
      return NextResponse.json(
        { error: 'Не найден подходящий модуль для замены' },
        { status: 404 }
      );
    }

    // Обновляем видео в тренировке
    await prisma.workoutSessionVideo.update({
      where: {
        id: currentVideo.id,
      },
      data: {
        videoId: newModule.id,
        completed: false,
      },
    });

    console.log(`✅ Модуль заменен: ${newModule.title}`);

    return NextResponse.json({
      success: true,
      newModule: {
        id: newModule.id,
        title: newModule.title,
        description: newModule.description,
        duration: newModule.duration,
        videoUrl: newModule.videoUrl,
        thumbnail: newModule.thumbnail,
        moduleType: newModule.moduleType,
        trainer: {
          id: newModule.trainer.id,
          name: newModule.trainer.name,
          lastName: newModule.trainer.lastName,
          avatar: newModule.trainer.avatar,
        },
      },
    });
  } catch (error: any) {
    console.error('❌ Ошибка при замене модуля:', error);
    return NextResponse.json(
      {
        error: 'Не удалось заменить модуль',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
