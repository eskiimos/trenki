import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { WorkoutStatus } from '@/generated/prisma';

/**
 * POST /api/training/cancel
 * Отменяет тренировку (status = SKIPPED)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, userId } = body;

    if (!sessionId || !userId) {
      return NextResponse.json(
        { error: 'sessionId и userId обязательны' },
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

    let requestUser = await prisma.user.findUnique({
      where: { telegramId: userId },
      select: { id: true },
    });

    if (!requestUser) {
      requestUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true },
      });
    }

    if (!requestUser || session.userId !== requestUser.id) {
      return NextResponse.json(
        { error: 'Доступ запрещен' },
        { status: 403 }
      );
    }

    if (session.status === WorkoutStatus.COMPLETED) {
      return NextResponse.json(
        { error: 'Тренировка уже завершена' },
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
