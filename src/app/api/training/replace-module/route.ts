import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  ModuleType,
  LoadType,
  MuscleGroup,
  ComplexityLevel,
  TrainingGoal,
  EnergyState,
} from '@/generated/prisma';
import {
  getComplexityLevel,
  getAllowedComplexityLevels,
  GOAL_TO_MUSCLE_GROUPS,
  GOAL_TO_LOAD_TYPES,
  getWarmupLoadTypes,
  applyAgeModifiers,
} from '@/lib/training-algorithm-v3';
import {
  selectModuleWithFallback,
  createSearchCriteria,
} from '@/lib/module-selection-v3';
import { requireAuthUser } from '@/lib/coach/guards';

/**
 * POST /api/training/replace-module
 *
 * Заменяет модуль в тренировке на другой подходящий
 * Body: { workoutSessionId: string, moduleIndex: number (0-3) }
 * Auth: httpOnly session.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuthUser(request);
    if ('response' in auth) return auth.response;
    const user = auth.user;

    const { workoutSessionId, moduleIndex } = await request.json();

    if (!workoutSessionId || moduleIndex === undefined) {
      return NextResponse.json(
        { error: 'workoutSessionId и moduleIndex обязательны' },
        { status: 400 }
      );
    }

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
      },
    });

    if (!workoutSession) {
      return NextResponse.json(
        { error: 'Тренировка не найдена' },
        { status: 404 }
      );
    }

    // Проверяем владельца
    if (workoutSession.userId !== user.id) {
      return NextResponse.json(
        { error: 'Доступ запрещен' },
        { status: 403 }
      );
    }

    // Получаем профиль пользователя для подбора модуля
    const userProfile = await prisma.profile.findUnique({
      where: { userId: user.id },
    });

    if (!userProfile) {
      return NextResponse.json(
        { error: 'Профиль пользователя не найден' },
        { status: 404 }
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
    const profile = userProfile;
    const currentModuleType = currentVideo.video.moduleType;

    // Определяем уровень сложности и RPE диапазон
    const complexityLevel = getComplexityLevel(profile!.potential);
    const allowedComplexityLevels = getAllowedComplexityLevels(
      complexityLevel,
      EnergyState.IN_TONE // Используем среднее значение для замены
    );

    // Получаем цель тренировки из последних целей пользователя (если есть)
    const trainingGoal = profile.lastGoals?.[0] as TrainingGoal | null;
    const energyState = EnergyState.IN_TONE; // По умолчанию используем IN_TONE


    let newModule: any = null;

    // Подбираем новый модуль того же типа
    if (currentModuleType === ModuleType.WARMUP) {
      const warmupLoadTypes = getWarmupLoadTypes(energyState);
      const muscleGroups = trainingGoal
        ? GOAL_TO_MUSCLE_GROUPS[trainingGoal as TrainingGoal]?.warmup || [MuscleGroup.FULL_BODY]
        : [MuscleGroup.FULL_BODY];

      const criteria = createSearchCriteria(
        ModuleType.WARMUP,
        warmupLoadTypes,
        muscleGroups,
        allowedComplexityLevels,
        { min: 1, max: 5 },
        profile.ageGroup || undefined,
        trainingGoal || undefined
      );

      console.log('📋 Критерии поиска:', JSON.stringify({
        moduleType: criteria.moduleType,
        loadTypes: criteria.loadTypes,
        muscleGroups: criteria.muscleGroups,
      }));

      const result = await selectModuleWithFallback(
        criteria,
        [currentVideo.videoId, ...workoutSession.videos.map(v => v.videoId)]
      );

      if (result.video) {
        newModule = result.video;
      }
    } else if (currentModuleType === ModuleType.COOLDOWN) {
      // Заминка
      const muscleGroups = trainingGoal
        ? GOAL_TO_MUSCLE_GROUPS[trainingGoal as TrainingGoal]?.cooldown || [MuscleGroup.FULL_BODY]
        : [MuscleGroup.FULL_BODY];

      const criteria = createSearchCriteria(
        ModuleType.COOLDOWN,
        [LoadType.STATIC_STRETCH, LoadType.MOBILITY, LoadType.PREHAB],
        muscleGroups,
        allowedComplexityLevels,
        { min: 1, max: 4 },
        profile.ageGroup || undefined,
        trainingGoal || undefined
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
        ? GOAL_TO_LOAD_TYPES[trainingGoal as TrainingGoal].fitness
        : [LoadType.POWER];

      loadTypes = applyAgeModifiers(
        loadTypes,
        profile.ageGroup || undefined
      );

      const muscleGroups = trainingGoal
        ? GOAL_TO_MUSCLE_GROUPS[trainingGoal as TrainingGoal]?.fitness || [MuscleGroup.FULL_BODY]
        : [MuscleGroup.FULL_BODY];

      const rpeMin = Math.max(3, complexityLevel === ComplexityLevel.BEGINNER ? 3 : 4);
      const rpeMax = complexityLevel === ComplexityLevel.PRO ? 8 : 7;

      const criteria = createSearchCriteria(
        ModuleType.FITNESS,
        loadTypes,
        muscleGroups,
        allowedComplexityLevels,
        { min: rpeMin, max: rpeMax },
        profile.ageGroup || undefined
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
        ? GOAL_TO_LOAD_TYPES[trainingGoal as TrainingGoal].technique
        : [LoadType.TECHNICAL_SKILL];

      loadTypes = applyAgeModifiers(
        loadTypes,
        profile.ageGroup || undefined
      );

      const muscleGroups = trainingGoal
        ? GOAL_TO_MUSCLE_GROUPS[trainingGoal as TrainingGoal]?.technique || [MuscleGroup.FULL_BODY]
        : [MuscleGroup.FULL_BODY];

      const rpeMin = Math.max(2, complexityLevel === ComplexityLevel.BEGINNER ? 2 : 3);
      const rpeMax = complexityLevel === ComplexityLevel.PRO ? 7 : 6;

      const criteria = createSearchCriteria(
        ModuleType.TECHNIQUE,
        loadTypes,
        muscleGroups,
        allowedComplexityLevels,
        { min: rpeMin, max: rpeMax },
        profile.ageGroup || undefined
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
      console.error('❌ Не найден подходящий модуль для замены');
      return NextResponse.json(
        { error: 'Не найден подходящий модуль для замены' },
        { status: 404 }
      );
    }


    // Обновляем видео в тренировке
    try {
      // Используем delete + create вместо update, чтобы избежать конфликта unique constraint
      await prisma.workoutSessionVideo.delete({
        where: {
          id: currentVideo.id,
        },
      });

      await prisma.workoutSessionVideo.create({
        data: {
          sessionId: currentVideo.sessionId,
          videoId: newModule.id,
          order: currentVideo.order,
          completed: false,
        },
      });


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
          trainer: newModule.trainer ? {
            id: newModule.trainer.id,
            name: newModule.trainer.name,
            lastName: newModule.trainer.lastName,
            avatar: newModule.trainer.avatar,
          } : null,
        },
      });
    } catch (dbError: any) {
      console.error('❌ Ошибка при обновлении БД:', dbError.message);
      throw dbError;
    }
  } catch (error: any) {
    console.error('❌ Ошибка при замене модуля:', error);
    return NextResponse.json(
      {
        error: 'Не удалось заменить модуль',
      },
      { status: 500 }
    );
  }
}
