import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { WorkoutStatus } from '@/generated/prisma';

/**
 * POST /api/training/complete
 * Завершает тренировку и обновляет статус
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

    // Проверяем, что все видео в тренировке завершены
    const session = await prisma.workoutSession.findUnique({
      where: { id: sessionId },
      include: {
        videos: true,
      },
    });

    if (!session) {
      return NextResponse.json(
        { error: 'Тренировка не найдена' },
        { status: 404 }
      );
    }

    if (session.userId !== userId) {
      return NextResponse.json(
        { error: 'Доступ запрещен' },
        { status: 403 }
      );
    }

    const allCompleted = session.videos.every(v => v.completed);
    
    if (!allCompleted) {
      return NextResponse.json(
        { error: 'Не все видео завершены' },
        { status: 400 }
      );
    }

    // Обновляем статус тренировки на COMPLETED
    const updatedSession = await prisma.workoutSession.update({
      where: { id: sessionId },
      data: {
        status: WorkoutStatus.COMPLETED,
        completedAt: new Date(),
      },
    });

    console.log('✅ Workout completed:', {
      sessionId: updatedSession.id,
      status: updatedSession.status,
      completedAt: updatedSession.completedAt,
    });

    return NextResponse.json({
      success: true,
      message: 'Тренировка успешно завершена!',
      workout: updatedSession,
    });

  } catch (error) {
    console.error('❌ Error completing workout:', error);
    return NextResponse.json(
      { error: 'Ошибка при завершении тренировки' },
      { status: 500 }
    );
  }
}
