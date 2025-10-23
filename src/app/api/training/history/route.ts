import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { WorkoutStatus } from '@/generated/prisma';

/**
 * GET /api/training/history?userId=xxx&limit=10&offset=0
 * Получает историю тренировок пользователя
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = parseInt(searchParams.get('offset') || '0');

    if (!userId) {
      return NextResponse.json(
        { error: 'userId обязателен' },
        { status: 400 }
      );
    }

    // Получаем историю тренировок
    const [workouts, total] = await Promise.all([
      prisma.workoutSession.findMany({
        where: {
          userId,
          status: {
            in: [WorkoutStatus.COMPLETED, WorkoutStatus.SKIPPED],
          },
        },
        include: {
          modules: {
            include: {
              module: {
                select: {
                  id: true,
                  name: true,
                  type: true,
                  duration: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.workoutSession.count({
        where: {
          userId,
          status: {
            in: [WorkoutStatus.COMPLETED, WorkoutStatus.SKIPPED],
          },
        },
      }),
    ]);

    // Рассчитываем статистику
    const stats = await calculateStats(userId);

    return NextResponse.json({
      success: true,
      workouts: workouts.map((w) => ({
        id: w.id,
        status: w.status,
        targetDuration: w.targetDuration,
        actualDuration: w.actualDuration,
        targetRPE: w.targetRPE,
        actualRPE: w.actualRPE,
        loadDirection: w.loadDirection,
        modulesCount: w.modules.length,
        createdAt: w.createdAt,
        completedAt: w.completedAt,
      })),
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
      stats,
    });
  } catch (error) {
    console.error('Ошибка получения истории:', error);
    return NextResponse.json(
      { error: 'Ошибка сервера' },
      { status: 500 }
    );
  }
}

/**
 * Рассчитывает статистику тренировок пользователя
 */
async function calculateStats(userId: string) {
  const [
    completedWorkouts,
    totalDuration,
    avgRPE,
    lastWorkout,
    currentStreak,
  ] = await Promise.all([
    // Количество завершенных тренировок
    prisma.workoutSession.count({
      where: {
        userId,
        status: WorkoutStatus.COMPLETED,
      },
    }),

    // Общая длительность
    prisma.workoutSession.aggregate({
      where: {
        userId,
        status: WorkoutStatus.COMPLETED,
        actualDuration: { not: null },
      },
      _sum: {
        actualDuration: true,
      },
    }),

    // Средний RPE
    prisma.workoutSession.aggregate({
      where: {
        userId,
        status: WorkoutStatus.COMPLETED,
        actualRPE: { not: null },
      },
      _avg: {
        actualRPE: true,
      },
    }),

    // Последняя тренировка
    prisma.workoutSession.findFirst({
      where: {
        userId,
        status: WorkoutStatus.COMPLETED,
      },
      orderBy: { completedAt: 'desc' },
      select: {
        completedAt: true,
      },
    }),

    // Текущая серия (упрощенный расчет)
    calculateCurrentStreak(userId),
  ]);

  return {
    totalWorkouts: completedWorkouts,
    totalDuration: totalDuration._sum.actualDuration || 0,
    avgRPE: avgRPE._avg.actualRPE ? Math.round(avgRPE._avg.actualRPE * 10) / 10 : 0,
    lastWorkoutDate: lastWorkout?.completedAt || null,
    currentStreak,
  };
}

/**
 * Рассчитывает текущую серию тренировок (дни подряд)
 */
async function calculateCurrentStreak(userId: string): Promise<number> {
  const workouts = await prisma.workoutSession.findMany({
    where: {
      userId,
      status: WorkoutStatus.COMPLETED,
      completedAt: { not: null },
    },
    orderBy: { completedAt: 'desc' },
    take: 30, // проверяем последние 30 тренировок
  });

  if (workouts.length === 0) return 0;

  let streak = 0;
  let currentDate = new Date();
  currentDate.setHours(0, 0, 0, 0);

  for (const workout of workouts) {
    if (!workout.completedAt) continue;

    const workoutDate = new Date(workout.completedAt);
    workoutDate.setHours(0, 0, 0, 0);

    const diffDays = Math.floor(
      (currentDate.getTime() - workoutDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (diffDays === streak) {
      streak++;
    } else if (diffDays > streak + 1) {
      break; // серия прервана
    }
  }

  return streak;
}
