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

      // Позиция для продолжения с места обрыва: прогресс пишется сюда каждые 5с
      // (action:'progress'). Завершённый модуль отдаёт 0 — иначе повторный вход
      // сразу прыгал бы в конец и давал ложный зачёт.
      const row = await prisma.workoutSessionVideo.findUnique({
        where: { sessionId_videoId: { sessionId, videoId } },
        select: { watchedDuration: true, completed: true },
      });
      const resumeAt = row && !row.completed ? row.watchedDuration ?? 0 : 0;

      return NextResponse.json({
        success: true,
        message: 'Видео начато',
        resumeAt,
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
      // Пропущенные модули не блокируют «все просмотрены» (скипы → PARTIAL)
      const allCompleted = session.videos.every((v) => v.completed || v.skipped);


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

    // Пропустить модуль (правки «Конец августа»): completed НЕ трогаем —
    // пропущенный модуль не даёт ни XP, ни прироста (античит), но перестаёт
    // блокировать завершение сессии (финиш со скипами = PARTIAL без бонуса,
    // см. /api/training/complete). Клиент ПЕРЕД вызовом показывает
    // предупреждение «что теряешь» (GET /api/training/skip-preview).
    if (action === 'skip' && videoId) {
      const row = await prisma.workoutSessionVideo.findUnique({
        where: { sessionId_videoId: { sessionId, videoId } },
        select: { completed: true, skipped: true },
      });
      if (!row) {
        return NextResponse.json({ error: 'Модуль не найден' }, { status: 404 });
      }
      if (row.completed) {
        return NextResponse.json({ error: 'Модуль уже пройден' }, { status: 400 });
      }
      if (!row.skipped) {
        await prisma.workoutSessionVideo.updateMany({
          where: { sessionId, videoId },
          data: { skipped: true, skippedAt: new Date() },
        });
      }

      const session = await prisma.workoutSession.findUnique({
        where: { id: sessionId },
        include: { videos: { orderBy: { order: 'asc' } } },
      });
      if (!session) {
        return NextResponse.json({ error: 'Тренировка не найдена' }, { status: 404 });
      }

      const anyCompleted = session.videos.some((v) => v.completed);
      const allDone = session.videos.every((v) => v.completed || v.skipped);

      // Пропущены ВСЕ модули — засчитывать нечего: сессия закрывается как
      // SKIPPED (без XP и дня серии). Идемпотентно через статусный notIn.
      if (allDone && !anyCompleted) {
        await prisma.workoutSession.updateMany({
          where: {
            id: sessionId,
            status: { notIn: [WorkoutStatus.COMPLETED, WorkoutStatus.PARTIAL] },
          },
          data: { status: WorkoutStatus.SKIPPED, completedAt: new Date() },
        });
        return NextResponse.json({
          success: true,
          allSkipped: true,
          message: 'Все модули пропущены — тренировка не засчитана',
        });
      }

      return NextResponse.json({
        success: true,
        completed: allDone,
        message: allDone ? 'Остались только пропущенные — можно завершать' : 'Модуль пропущен',
      });
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
