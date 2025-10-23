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

    if (!userId) {
      return NextResponse.json(
        { error: 'userId обязателен' },
        { status: 400 }
      );
    }

    // Ищем активную тренировку (PENDING или IN_PROGRESS)
    const workout = await prisma.workoutSession.findFirst({
      where: {
        userId,
        status: {
          in: [WorkoutStatus.PENDING, WorkoutStatus.IN_PROGRESS],
        },
      },
      include: {
        modules: {
          include: {
            module: {
              include: {
                video: true,
              },
            },
          },
          orderBy: { order: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!workout) {
      return NextResponse.json(
        { error: 'Активная тренировка не найдена' },
        { status: 404 }
      );
    }

    // Рассчитываем прогресс
    const totalModules = workout.modules.length;
    const completedModules = workout.modules.filter((m) => m.completed).length;
    const progress = totalModules > 0 ? (completedModules / totalModules) * 100 : 0;

    return NextResponse.json({
      success: true,
      workout: {
        id: workout.id,
        status: workout.status,
        targetDuration: workout.targetDuration,
        targetRPE: workout.targetRPE,
        loadDirection: workout.loadDirection,
        progress: Math.round(progress),
        createdAt: workout.createdAt,
        modules: workout.modules.map((wm) => ({
          id: wm.id,
          moduleId: wm.module.id,
          name: wm.module.name,
          description: wm.module.description,
          type: wm.module.type,
          duration: wm.module.duration,
          rpeRange: `${wm.module.rpeMin}-${wm.module.rpeMax}`,
          video: wm.module.video,
          order: wm.order,
          completed: wm.completed,
          actualRPE: wm.actualRPE,
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
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { workoutId, action, moduleId, actualRPE } = body;

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
        data: { status: WorkoutStatus.IN_PROGRESS },
      });

      return NextResponse.json({
        success: true,
        workout,
        message: 'Тренировка начата',
      });
    }

    // Завершить модуль
    if (action === 'completeModule' && moduleId) {
      const workoutModule = await prisma.workoutSessionModule.update({
        where: { id: moduleId },
        data: {
          completed: true,
          actualRPE: actualRPE || null,
        },
      });

      // Добавляем в историю пользователя
      const workout = await prisma.workoutSession.findUnique({
        where: { id: workoutId },
        select: { userId: true },
      });

      if (workout) {
        await prisma.userModuleHistory.create({
          data: {
            userId: workout.userId,
            moduleId: workoutModule.moduleId,
            rpe: actualRPE || null,
          },
        });
      }

      return NextResponse.json({
        success: true,
        module: workoutModule,
        message: 'Модуль завершен',
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
          modules: {
            include: {
              module: true,
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
