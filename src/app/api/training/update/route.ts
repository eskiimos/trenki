import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { WorkoutStatus } from '@/generated/prisma';
import { requireAuthUser } from '@/lib/coach/guards';

/**
 * POST /api/training/update
 * Обновляет прогресс выполнения тренировки.
 * Auth: httpOnly session + проверка владения sessionId.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuthUser(request);
    if ('response' in auth) return auth.response;

    const body = await request.json();
    const { sessionId, videoId, action, watchedDuration, actualRPE } = body;

    if (!sessionId) {
      return NextResponse.json(
        { error: 'sessionId обязателен' },
        { status: 400 }
      );
    }

    // Проверяем, что эта сессия принадлежит текущему пользователю
    const owner = await prisma.workoutSession.findUnique({
      where: { id: sessionId },
      select: { userId: true },
    });
    if (!owner || owner.userId !== auth.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Начать видео
    if (action === 'start' && videoId) {
      const session = await prisma.workoutSession.findUnique({
        where: { id: sessionId },
      });

      if (session && session.status === WorkoutStatus.PENDING) {
        await prisma.workoutSession.update({
          where: { id: sessionId },
          data: {
            status: WorkoutStatus.IN_PROGRESS,
            startedAt: new Date(),
          },
        });
      }

      // Отмечаем начало видео
      await prisma.workoutSessionVideo.updateMany({
        where: { sessionId, videoId },
        data: { startedAt: new Date() },
      });


      return NextResponse.json({
        success: true,
        message: 'Видео начато',
      });
    }

    // Завершить видео
    if (action === 'complete' && videoId) {

      // Отмечаем видео как завершенное
      const updateResult = await prisma.workoutSessionVideo.updateMany({
        where: { sessionId, videoId },
        data: {
          completed: true,
          completedAt: new Date(),
          watchedDuration: watchedDuration || null,
          actualRPE: actualRPE || null,
        },
      });


      // Получаем текущую сессию
      const session = await prisma.workoutSession.findUnique({
        where: { id: sessionId },
        include: {
          videos: {
            orderBy: { order: 'asc' },
          },
        },
      });

      if (!session) {
        return NextResponse.json(
          { error: 'Тренировка не найдена' },
          { status: 404 }
        );
      }

      console.log('📊 Session state:', {
        currentVideoIndex: session.currentVideoIndex,
        totalVideos: session.totalVideos,
        videos: session.videos.map((v, i) => ({
          index: i,
          videoId: v.videoId,
          completed: v.completed,
        })),
      });

      // Увеличиваем currentVideoIndex
      const nextIndex = session.currentVideoIndex + 1;
      const allCompleted = session.videos.every((v) => v.completed);


      // Все видео просмотрены — двигаем индекс, но НЕ ставим COMPLETED здесь.
      // Финализацию (статус COMPLETED) И НАЧИСЛЕНИЕ прироста делает единая точка
      // POST /api/training/complete (её зовёт кнопка «Завершить» на workout-
      // странице). Раньше update ставил COMPLETED раньше → complete видел
      // COMPLETED и делал no-op: прирост за цикловые тренировки не начислялся,
      // не показывался поп-ап прироста, не срабатывали дневной лимит и
      // автозакрытие тренерских заданий.
      if (allCompleted || nextIndex >= session.totalVideos) {
        await prisma.workoutSession.update({
          where: { id: sessionId },
          data: { currentVideoIndex: nextIndex },
        });


        return NextResponse.json({
          success: true,
          completed: true,
          message: 'Все модули просмотрены',
        });
      } else {
        // Просто увеличиваем индекс
        await prisma.workoutSession.update({
          where: { id: sessionId },
          data: { currentVideoIndex: nextIndex },
        });


        return NextResponse.json({
          success: true,
          completed: false,
          currentVideoIndex: nextIndex,
          totalVideos: session.totalVideos,
          message: 'Видео завершено',
        });
      }
    }

    // Обновить прогресс просмотра (для отслеживания во время просмотра)
    if (action === 'progress' && videoId && watchedDuration !== undefined) {
      await prisma.workoutSessionVideo.updateMany({
        where: { sessionId, videoId },
        data: { watchedDuration },
      });

      return NextResponse.json({
        success: true,
        message: 'Прогресс обновлен',
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
