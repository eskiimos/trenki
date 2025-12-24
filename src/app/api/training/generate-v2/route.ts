import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { LoadDirection, VideoDifficulty, LoadType, WorkoutStatus } from '@/generated/prisma/client';

/**
 * НОВЫЙ АЛГОРИТМ ГЕНЕРАЦИИ ТРЕНИРОВОК v2.0
 * 
 * Основан на:
 * - LoadType тегах (POWER, SPEED, ENDURANCE, TECHNIQUE, FLEXIBILITY)
 * - Характеристиках пользователя (ratingPower, ratingSpeed и т.д.)
 * - Умном подборе: развиваем слабые стороны, усиливаем сильные
 */

export async function POST(request: NextRequest) {
  try {
    const { userId, loadDirection, availableTime } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    console.log('🎯 Generating workout with LoadType algorithm:', { userId, loadDirection, availableTime });

    // Находим пользователя по telegramId
    const user = await prisma.user.findUnique({
      where: { telegramId: userId },
      include: {
        profile: {
          select: {
            ratingPower: true,
            ratingSpeed: true,
            ratingEndurance: true,
            ratingTechnique: true,
            ratingFlexibility: true,
            potential: true,
            modulesToday: true,
            trainingsToday: true,
          }
        }
      }
    });

    if (!user || !user.profile) {
      return NextResponse.json({ 
        error: 'Profile not found. Please complete the onboarding survey first.',
        redirectTo: '/onboarding/characteristics'
      }, { status: 404 });
    }

    const profile = user.profile;

    // Анализируем характеристики: находим слабую и сильную
    const characteristics = {
      POWER: profile.ratingPower,
      SPEED: profile.ratingSpeed,
      ENDURANCE: profile.ratingEndurance,
      TECHNIQUE: profile.ratingTechnique,
      FLEXIBILITY: profile.ratingFlexibility,
    };

    const sorted = Object.entries(characteristics).sort((a, b) => a[1] - b[1]);
    const weakest = sorted[0][0]; // Самая слабая
    const strongest = sorted[sorted.length - 1][0]; // Самая сильная
    const middle = sorted[Math.floor(sorted.length / 2)][0]; // Средняя

    console.log('📊 User characteristics:', {
      weakest: `${weakest} (${sorted[0][1]})`,
      middle: `${middle} (${sorted[Math.floor(sorted.length / 2)][1]})`,
      strongest: `${strongest} (${sorted[sorted.length - 1][1]})`,
    });

    // Определяем сложность на основе loadDirection
    const difficultyMap: Record<LoadDirection, VideoDifficulty[]> = {
      [LoadDirection.LIGHT]: [VideoDifficulty.BEGINNER, VideoDifficulty.INTERMEDIATE],
      [LoadDirection.MEDIUM]: [VideoDifficulty.BEGINNER, VideoDifficulty.INTERMEDIATE, VideoDifficulty.ADVANCED],
      [LoadDirection.HIGH]: [VideoDifficulty.INTERMEDIATE, VideoDifficulty.ADVANCED, VideoDifficulty.EXPERT],
    };

    const allowedDifficulties = difficultyMap[loadDirection as LoadDirection] || [VideoDifficulty.BEGINNER, VideoDifficulty.INTERMEDIATE];

    // Формируем тренировку: РАЗМИНКА → ОСНОВНАЯ ЧАСТЬ → ЗАМИНКА
    const workout = await buildWorkout({
      userId,
      weakest,
      strongest,
      middle,
      allowedDifficulties,
      availableTime: availableTime || 45,
    });

    // Если нет модулей, возвращаем ошибку с информацией о недостающих
    if (!workout.modules || workout.modules.length === 0) {
      return NextResponse.json({
        error: 'No suitable videos found for workout generation',
        suggestion: 'Try different difficulty level or add more videos to the database',
        missingModules: workout.missingModules || []
      }, { status: 404 });
    }

    // Создаём WorkoutSession в БД
    const workoutSession = await prisma.workoutSession.create({
      data: {
        userId: user.id, // Используем внутренний ID пользователя
        targetDuration: availableTime || 45,
        targetRPE: 5, // Средний RPE для LoadType системы
        loadDirection: loadDirection as LoadDirection,
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

    console.log('✅ WorkoutSession created:', workoutSession.id);

    return NextResponse.json({
      success: true,
      workoutId: workoutSession.id,
      workout: {
        id: workoutSession.id,
        ...workout,
      },
      meta: {
        focusArea: weakest,
        difficulty: loadDirection,
        modulesUsed: workout.modules.length,
        totalDuration: workout.totalDuration,
      }
    });

  } catch (error: any) {
    console.error('❌ Error generating workout:', error);
    return NextResponse.json({ 
      error: 'Failed to generate workout',
      details: error.message,
      missingModules: error.missingModules || []
    }, { status: 500 });
  }
}

/**
 * Строим тренировку из 3 модулей:
 * 1. WARMUP (Разминка) - MOBILITY или DYNAMIC_STRETCH
 * 2. MAIN (Основная часть) - Развиваем СЛАБУЮ характеристику
 * 3. COOLDOWN (Заминка) - STATIC_STRETCH или FLEXIBILITY
 */
async function buildWorkout(params: {
  userId: string;
  weakest: string;
  strongest: string;
  middle: string;
  allowedDifficulties: VideoDifficulty[];
  availableTime: number;
}) {
  const { userId, weakest, allowedDifficulties, availableTime } = params;
  const modules: any[] = [];
  let totalDuration = 0;
  const missingModules: string[] = [];

  // 1. РАЗМИНКА (5-10 минут) - MOBILITY или DYNAMIC_STRETCH
  const warmup: any = await prisma.video.findFirst({
    where: {
      isPublished: true,
      difficulty: { in: allowedDifficulties },
      duration: { lte: 600 }, // max 10 минут
      videoTags: {
        some: {
          tag: {
            tagType: 'LOAD',
            loadType: { in: [LoadType.MOBILITY, LoadType.DYNAMIC_STRETCH] }
          }
        }
      }
    },
    include: {
      trainer: {
        select: {
          id: true,
          name: true,
          lastName: true,
          avatar: true,
        }
      },
      videoTags: {
        include: {
          tag: true
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  if (warmup) {
    modules.push({
      id: warmup.id,
      title: warmup.title,
      description: warmup.description,
      duration: warmup.duration,
      videoUrl: warmup.videoUrl,
      thumbnail: warmup.thumbnail,
      trainer: {
        id: warmup.trainer.id,
        name: warmup.trainer.name,
        lastName: warmup.trainer.lastName,
        avatar: warmup.trainer.avatar || '/images/avatars/trainer-avatar-1.png',
      },
      moduleType: 'WARMUP',
      loadTypes: warmup.videoTags.map((vt: any) => vt.tag.loadType).filter(Boolean),
    });
    totalDuration += warmup.duration;
  } else {
    console.log('⚠️ РАЗМИНКА не найдена. Требуется видео с LoadType: MOBILITY или DYNAMIC_STRETCH, длительность до 10 минут');
    missingModules.push('РАЗМИНКА (LoadType: MOBILITY или DYNAMIC_STRETCH)');
  }

  // 2. ОСНОВНАЯ ЧАСТЬ (20-30 минут) - Развиваем СЛАБУЮ характеристику
  const mainLoadTypes = getMainLoadTypes(weakest);
  
  // Пытаемся найти идеальное видео (20-30 минут, нужный LoadType)
  let mainWorkout: any = await prisma.video.findFirst({
    where: {
      isPublished: true,
      difficulty: { in: allowedDifficulties },
      duration: { 
        gte: 1200, // min 20 минут
        lte: 1800  // max 30 минут
      },
      id: { notIn: modules.map((m: any) => m.id) },
      videoTags: {
        some: {
          tag: {
            tagType: 'LOAD',
            loadType: { in: mainLoadTypes as LoadType[] }
          }
        }
      }
    },
    include: {
      trainer: {
        select: {
          id: true,
          name: true,
          lastName: true,
          avatar: true,
        }
      },
      videoTags: {
        include: {
          tag: true
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  // Если не нашли идеальное видео, берём любое с LoadType (кроме WARMUP/COOLDOWN типов)
  if (!mainWorkout) {
    console.log('⚠️ Не найдено идеальное видео для MAIN, ищем запасной вариант...');
    mainWorkout = await prisma.video.findFirst({
      where: {
        isPublished: true,
        difficulty: { in: allowedDifficulties },
        duration: { gte: 300 }, // хотя бы 5 минут
        id: { notIn: modules.map((m: any) => m.id) },
        videoTags: {
          some: {
            tag: {
              tagType: 'LOAD',
              loadType: { 
                notIn: [LoadType.STATIC_STRETCH, LoadType.PREHAB] // Исключаем только типы для заминки
              }
            }
          }
        }
      },
      include: {
        trainer: {
          select: {
            id: true,
            name: true,
            lastName: true,
            avatar: true,
          }
        },
        videoTags: {
          include: {
            tag: true
          }
        }
      },
      orderBy: { duration: 'desc' } // Берём самое длинное
    });
  }

  if (mainWorkout) {
    modules.push({
      id: mainWorkout.id,
      title: mainWorkout.title,
      description: mainWorkout.description,
      duration: mainWorkout.duration,
      videoUrl: mainWorkout.videoUrl,
      thumbnail: mainWorkout.thumbnail,
      trainer: {
        id: mainWorkout.trainer.id,
        name: mainWorkout.trainer.name,
        lastName: mainWorkout.trainer.lastName,
        avatar: mainWorkout.trainer.avatar || '/images/avatars/trainer-avatar-1.png',
      },
      moduleType: 'MAIN',
      loadTypes: mainWorkout.videoTags.map((vt: any) => vt.tag.loadType).filter(Boolean),
      focusArea: weakest,
    });
    totalDuration += mainWorkout.duration;
  } else {
    const mainLoadTypes = getMainLoadTypes(weakest);
    console.log(`⚠️ ОСНОВНАЯ ЧАСТЬ не найдена. Требуется видео с LoadType: ${mainLoadTypes.join(' или ')}, длительность 20-30 минут для развития характеристики: ${weakest}`);
    missingModules.push(`ОСНОВНАЯ ЧАСТЬ (LoadType: ${mainLoadTypes.join(' или ')}, фокус на ${weakest})`);
  }

  // 3. ЗАМИНКА (5-10 минут) - STATIC_STRETCH или FLEXIBILITY
  const cooldown: any = await prisma.video.findFirst({
    where: {
      isPublished: true,
      difficulty: { in: allowedDifficulties },
      duration: { lte: 600 }, // max 10 минут
      id: { notIn: modules.map((m: any) => m.id) },
      videoTags: {
        some: {
          tag: {
            tagType: 'LOAD',
            loadType: { in: [LoadType.STATIC_STRETCH, LoadType.MOBILITY] }
          }
        }
      }
    },
    include: {
      trainer: {
        select: {
          id: true,
          name: true,
          lastName: true,
          avatar: true,
        }
      },
      videoTags: {
        include: {
          tag: true
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  if (cooldown) {
    modules.push({
      id: cooldown.id,
      title: cooldown.title,
      description: cooldown.description,
      duration: cooldown.duration,
      videoUrl: cooldown.videoUrl,
      thumbnail: cooldown.thumbnail,
      trainer: {
        id: cooldown.trainer.id,
        name: cooldown.trainer.name,
        lastName: cooldown.trainer.lastName,
        avatar: cooldown.trainer.avatar || '/images/avatars/trainer-avatar-1.png',
      },
      moduleType: 'COOLDOWN',
      loadTypes: cooldown.videoTags.map((vt: any) => vt.tag.loadType).filter(Boolean),
    });
    totalDuration += cooldown.duration;
  } else {
    console.log('⚠️ ЗАМИНКА не найдена. Требуется видео с LoadType: STATIC_STRETCH или MOBILITY, длительность до 10 минут');
    missingModules.push('ЗАМИНКА (LoadType: STATIC_STRETCH или MOBILITY)');
  }

  // Проверяем, что у нас есть хотя бы 1 модуль
  if (modules.length === 0) {
    const error: any = new Error('No suitable videos found for workout generation. Try different difficulty level or add more videos to the database.');
    error.missingModules = missingModules;
    throw error;
  }

  console.log(`✅ Собрано модулей: ${modules.length}`, {
    warmup: warmup?.title || '❌ Не найдена',
    main: mainWorkout?.title || '❌ Не найдена', 
    cooldown: cooldown?.title || '❌ Не найдена'
  });

  return {
    modules,
    totalDuration,
    missingModules,
    structure: {
      warmup: modules[0]?.title || 'Не найдена',
      main: modules[1]?.title || 'Не найдена',
      cooldown: modules[2]?.title || 'Не найдена',
    }
  };
}

/**
 * Маппинг характеристики на LoadType для основной части тренировки
 */
function getMainLoadTypes(characteristic: string): LoadType[] {
  const mapping: { [key: string]: LoadType[] } = {
    'POWER': [LoadType.POWER, LoadType.MAX_STRENGTH],
    'SPEED': [LoadType.SPEED, LoadType.AGILITY],
    'ENDURANCE': [LoadType.AEROBIC_ENDURANCE, LoadType.ANAEROBIC_ENDURANCE, LoadType.STRENGTH_ENDURANCE],
    'TECHNIQUE': [LoadType.TECHNICAL_SKILL, LoadType.AGILITY],
    'FLEXIBILITY': [LoadType.MOBILITY, LoadType.STATIC_STRETCH, LoadType.DYNAMIC_STRETCH],
  };

  return mapping[characteristic] || [LoadType.POWER];
}
