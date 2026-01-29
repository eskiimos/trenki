import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { WorkoutStatus } from '@/generated/prisma';

/**
 * GET /api/training/current?userId=xxx
 * Получает текущую активную тренировку пользователя
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    const workoutId = searchParams.get('workoutId');

    if (!userId && !workoutId) {
      return NextResponse.json(
        { error: 'userId или workoutId обязателен' },
        { status: 400 }
      );
    }

    // Ищем активную тренировку (PENDING или IN_PROGRESS)
    // Если передан workoutId — возвращаем тренировку по id (включая COMPLETED)
    let workout = workoutId
      ? await prisma.workoutSession.findUnique({
          where: { id: workoutId },
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
        })
      : null;

    if (!workout && userId) {
      // Находим пользователя по telegramId или внутреннему id
      let user = await prisma.user.findUnique({
        where: { telegramId: userId },
        select: { id: true },
      });

      if (!user) {
        user = await prisma.user.findUnique({
          where: { id: userId },
          select: { id: true },
        });
      }

      if (!user) {
        return NextResponse.json({ workout: null });
      }

      // Ищем активную тренировку (PENDING или IN_PROGRESS)
      workout = await prisma.workoutSession.findFirst({
        where: {
          userId: user.id,
          status: {
            in: [WorkoutStatus.PENDING, WorkoutStatus.IN_PROGRESS],
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
        orderBy: { createdAt: 'desc' },
      });
    }

    if (!workout) {
      return NextResponse.json({ workout: null });
    }

    // Рассчитываем прогресс
    const totalVideos = workout.totalVideos;
    const completedVideos = workout.videos.filter((v) => v.completed).length;
    const progress = totalVideos > 0 ? (completedVideos / totalVideos) * 100 : 0;

    return NextResponse.json({
      success: true,
      workout: {
        id: workout.id,
        status: workout.status,
        targetDuration: workout.targetDuration,
        targetRPE: workout.targetRPE,
        loadDirection: workout.loadDirection,
        currentVideoIndex: workout.currentVideoIndex,
        totalVideos: workout.totalVideos,
        progress: Math.round(progress),
        startedAt: workout.startedAt,
        createdAt: workout.createdAt,
        modules: workout.videos.map((wsVideo) => ({
          id: wsVideo.video.id,
          sessionVideoId: wsVideo.id,
          title: wsVideo.video.title,
          description: wsVideo.video.description,
          moduleType: wsVideo.video.moduleType || null,
          loadType: wsVideo.video.loadType || null,
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
          startedAt: wsVideo.startedAt,
          completedAt: wsVideo.completedAt,
          watchedDuration: wsVideo.watchedDuration,
        })),
      },
    });
  } catch (error) {
    console.error('Ошибка получения текущей тренировки:', error);
    return NextResponse.json(
      { error: 'Ошибка сервера' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/training/current
 * Обновляет статус текущей тренировки (начать/завершить)
 * 
 * DEPRECATED: Используйте /api/training/update вместо этого
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { workoutId, action, videoId, actualRPE } = body;

    if (!workoutId) {
      return NextResponse.json(
        { error: 'workoutId обязателен' },
        { status: 400 }
      );
    }

    // Начать тренировку
    if (action === 'start') {
      const workout = await prisma.workoutSession.update({
        where: { id: workoutId },
        data: { 
          status: WorkoutStatus.IN_PROGRESS,
          startedAt: new Date(),
        },
      });

      return NextResponse.json({
        success: true,
        workout,
        message: 'Тренировка начата',
      });
    }

    // Завершить видео
    if (action === 'completeVideo' && videoId) {
      const workoutVideo = await prisma.workoutSessionVideo.updateMany({
        where: { 
          sessionId: workoutId,
          videoId: videoId,
        },
        data: {
          completed: true,
          completedAt: new Date(),
          actualRPE: actualRPE || null,
        },
      });

      return NextResponse.json({
        success: true,
        video: workoutVideo,
        message: 'Видео завершено',
      });
    }

    // Завершить всю тренировку
    if (action === 'complete') {
      const { actualDuration, actualRPE: workoutActualRPE } = body;

      const workout = await prisma.workoutSession.update({
        where: { id: workoutId },
        data: {
          status: WorkoutStatus.COMPLETED,
          completedAt: new Date(),
          actualDuration: actualDuration || null,
          actualRPE: workoutActualRPE || null,
        },
        include: {
          videos: {
            include: {
              video: true,
            },
          },
        },
      });

      return NextResponse.json({
        success: true,
        workout,
        message: 'Тренировка завершена! Отличная работа! 💪',
      });
    }

    // Пропустить тренировку
    if (action === 'skip') {
      const workout = await prisma.workoutSession.update({
        where: { id: workoutId },
        data: { status: WorkoutStatus.SKIPPED },
      });

      return NextResponse.json({
        success: true,
        workout,
        message: 'Тренировка пропущена',
      });
    }

    return NextResponse.json(
      { error: 'Некорректное действие' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Ошибка обновления тренировки:', error);
    return NextResponse.json(
      { error: 'Ошибка сервера' },
      { status: 500 }
    );
  }
}
