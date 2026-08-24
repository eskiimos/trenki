import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { WorkoutStatus } from '@/generated/prisma';
import { requireAuthUser } from '@/lib/coach/guards';

/**
 * POST /api/training/cancel
 * Отменяет тренировку (status = SKIPPED). Auth: httpOnly session.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuthUser(request);
    if ('response' in auth) return auth.response;

    const body = await request.json();
    const { sessionId } = body;

    if (!sessionId) {
      return NextResponse.json(
        { error: 'sessionId обязателен' },
        { status: 400 }
      );
    }

    const session = await prisma.workoutSession.findUnique({
      where: { id: sessionId },
      select: { id: true, userId: true, status: true },
    });

    if (!session) {
      return NextResponse.json(
        { error: 'Тренировка не найдена' },
        { status: 404 }
      );
    }

    if (session.userId !== auth.user.id) {
      return NextResponse.json(
        { error: 'Доступ запрещен' },
        { status: 403 }
      );
    }

    // PARTIAL тоже нельзя отменять: досрочный финиш уже начислен (XP, день
    // серии, прирост) — отмена задним числом удаляла бы день из стрика/лиги.
    if (session.status === WorkoutStatus.COMPLETED || session.status === WorkoutStatus.PARTIAL) {
      return NextResponse.json(
        { error: 'Тренировка уже засчитана' },
        { status: 400 }
      );
    }

    if (session.status === WorkoutStatus.SKIPPED) {
      return NextResponse.json({
        success: true,
        message: 'Тренировка уже отменена',
      });
    }

    const updatedSession = await prisma.workoutSession.update({
      where: { id: sessionId },
      data: {
        status: WorkoutStatus.SKIPPED,
        completedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Тренировка отменена',
      workout: updatedSession,
    });
  } catch (error) {
    console.error('Ошибка отмены тренировки:', error);
    return NextResponse.json(
      { error: 'Ошибка сервера' },
      { status: 500 }
    );
  }
}
