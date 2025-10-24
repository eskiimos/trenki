import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { LoadDirection, WorkoutStatus } from '@/generated/prisma';
import { ensureDevUser } from '@/lib/dev-user';

// Маппинг русских названий типов модулей
const MODULE_TYPE_MAP: Record<string, string> = {
  'Разминка': 'WARMUP',
  'ОФП': 'FITNESS',
  'Техника': 'TECHNIQUE',
  'Заминка': 'COOLDOWN',
};

/**
 * POST /api/training/generate
 * Генерирует персональную тренировку на основе оценки состояния пользователя
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
    
    // DEV MODE: автоматически создаём пользователя, если его нет
    await ensureDevUser(userId);

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

    // Получаем историю последних выполненных модулей (п.6 - предотвращение повторов)
    const recentHistory = await prisma.userModuleHistory.findMany({
      where: {
        userId,
        completedAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // последние 7 дней
        },
      },
      select: { moduleId: true },
    });

    const recentModuleIds = recentHistory.map((h) => h.moduleId);

    // Подбираем видео по алгоритму
    const selectedVideos = await selectModulesForWorkout(
      assessment.loadDirection,
      assessment.recommendedRPE,
      assessment.availableTime,
      recentModuleIds,
      assessment // передаём assessment для определения статуса
    );

    if (selectedVideos.length === 0) {
      return NextResponse.json(
        { error: 'Не удалось подобрать подходящие видео для тренировки' },
        { status: 404 }
      );
    }

    // Рассчитываем общую длительность
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
          типМодуля: wsVideo.video.category || null,
          типНагрузки: wsVideo.video.difficulty || null,
          duration: wsVideo.video.duration,
          rpeRange: `${wsVideo.video.rpeМин}-${wsVideo.video.rpeМакс}`,
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
) {
  const videos: any[] = [];

  // Определяем статус тренировки из assessment
  const trainingStatus = getTrainingStatus(assessment);
  
  console.log('🎯 Selecting videos:', { loadDirection, targetRPE, trainingStatus });

  // ШАГ 1: Подбираем РАЗМИНКУ (любое видео с низким RPE)
  const warmup = await prisma.video.findFirst({
    where: {
      isPublished: true,
      id: { notIn: excludeModuleIds },
      rpeМакс: { lte: 5 }, // разминка всегда легкая
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
      rpeМин: { lte: targetRPE + 2 },
      rpeМакс: { gte: targetRPE - 2 },
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
      rpeМин: { lte: targetRPE + 2 },
      rpeМакс: { gte: targetRPE - 2 },
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
      rpeМакс: { lte: 5 }, // заминка легкая (до 5 RPE)
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
    console.log('⚠️ COOLDOWN (Заминка) не найдена!');
  }

  console.log(`📊 Итого подобрано видео: ${videos.length}`);
  return videos;
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
