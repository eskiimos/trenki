import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { WorkoutStatus, MicrocycleStatus } from '@/generated/prisma';
import { requireAuthUser } from '@/lib/coach/guards';
import { goalsFromStoredDays } from '@/lib/microcycle/week-plan';

/**
 * GET /api/training/current[?workoutId=xxx]
 * Получает активную тренировку текущего пользователя (или конкретную по workoutId).
 * Auth: httpOnly session cookie.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuthUser(request);
    if ('response' in auth) return auth.response;
    const userId = auth.user.id;

    const workoutId = request.nextUrl.searchParams.get('workoutId');

    let workout = workoutId
      ? await prisma.workoutSession.findUnique({
          where: { id: workoutId },
          include: {
            videos: {
              include: {
                video: { include: { trainer: true } },
              },
              orderBy: { order: 'asc' },
            },
            microcycleDay: { include: { microcycle: { include: { days: true } } } },
          },
        })
      : null;

    // Запросили чужую тренировку по workoutId — закрываем
    if (workoutId && workout && workout.userId !== userId) {
      return NextResponse.json({ workout: null }, { status: 404 });
    }

    if (!workout) {
      workout = await prisma.workoutSession.findFirst({
        where: {
          userId,
          status: { in: [WorkoutStatus.PENDING, WorkoutStatus.IN_PROGRESS] },
        },
        include: {
          videos: {
            include: {
              video: { include: { trainer: true } },
            },
            orderBy: { order: 'asc' },
          },
          microcycleDay: { include: { microcycle: { include: { days: true } } } },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (workout) {
        // Сессии, входящие в активный микроцикл, НЕ помечаем SKIPPED — иначе
        // открытие /training/workout без ?id (через «продолжить» / нижнее меню)
        // «пропустит» 4 из 5 дней недели. Микроцикл намеренно держит несколько
        // PENDING-сессий одновременно.
        const microcycleDays = await prisma.microcycleDay.findMany({
          where: {
            workoutSessionId: { not: null },
            microcycle: { userId, status: { not: MicrocycleStatus.ARCHIVED } },
          },
          select: { workoutSessionId: true },
        });
        const protectedIds = microcycleDays
          .map((d) => d.workoutSessionId)
          .filter((id): id is string => id !== null);

        await prisma.workoutSession.updateMany({
          where: {
            userId,
            status: { in: [WorkoutStatus.PENDING, WorkoutStatus.IN_PROGRESS] },
            id: { not: workout.id, notIn: protectedIds },
          },
          data: { status: WorkoutStatus.SKIPPED },
        });
      }
    }

    if (!workout) {
      return NextResponse.json({ workout: null });
    }

    const ownerProfile = await prisma.profile.findUnique({
      where: { userId: workout.userId },
      select: { lastGoals: true },
    });
    let trainingGoal: string | null = ownerProfile?.lastGoals?.[0] || null;
    let dayLabel: string | null = null;

    // Для тренировки из недельного цикла берём ЦЕЛЬ и подпись именно этого дня
    // (а не последнюю быструю цель из lastGoals). Цель восстанавливаем из
    // сохранённых intent + cycleNumber той же ротацией, что при генерации —
    // без отдельного хранения цели (миграция не нужна).
    const mday = workout.microcycleDay;
    if (mday?.microcycle) {
      const plans = goalsFromStoredDays(
        mday.microcycle.days.map((d) => ({ dayOfWeek: d.dayOfWeek, intent: d.intent })),
        mday.microcycle.cycleNumber,
      );
      const plan = plans.find((p) => p.dayOfWeek === mday.dayOfWeek);
      if (plan) {
        trainingGoal = plan.goal;
        dayLabel = plan.label;
      }
    }

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
        trainingGoal,
        dayLabel,
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
          equipment: wsVideo.video.equipment || [],
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
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 });
  }
}

/**
 * PATCH /api/training/current
 * Обновляет статус текущей тренировки (начать/завершить).
 * DEPRECATED: используйте /api/training/update / /complete вместо этого.
 * Auth: httpOnly session cookie + проверка владения workoutId.
 */
export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireAuthUser(request);
    if ('response' in auth) return auth.response;

    const body = await request.json();
    const { workoutId, action, videoId, actualRPE } = body;

    if (!workoutId) {
      return NextResponse.json({ error: 'workoutId обязателен' }, { status: 400 });
    }

    const owned = await prisma.workoutSession.findUnique({
      where: { id: workoutId },
      select: { userId: true },
    });
    if (!owned || owned.userId !== auth.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (action === 'start') {
      const workout = await prisma.workoutSession.update({
        where: { id: workoutId },
        data: { status: WorkoutStatus.IN_PROGRESS, startedAt: new Date() },
      });
      return NextResponse.json({ success: true, workout, message: 'Тренировка начата' });
    }

    if (action === 'completeVideo' && videoId) {
      const workoutVideo = await prisma.workoutSessionVideo.updateMany({
        where: { sessionId: workoutId, videoId },
        data: { completed: true, completedAt: new Date(), actualRPE: actualRPE || null },
      });
      return NextResponse.json({ success: true, video: workoutVideo, message: 'Видео завершено' });
    }

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
        include: { videos: { include: { video: true } } },
      });
      return NextResponse.json({
        success: true,
        workout,
        message: 'Тренировка завершена! Отличная работа! 💪',
      });
    }

    if (action === 'skip') {
      const workout = await prisma.workoutSession.update({
        where: { id: workoutId },
        data: { status: WorkoutStatus.SKIPPED },
      });
      return NextResponse.json({ success: true, workout, message: 'Тренировка пропущена' });
    }

    return NextResponse.json({ error: 'Некорректное действие' }, { status: 400 });
  } catch (error) {
    console.error('Ошибка обновления тренировки:', error);
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 });
  }
}
