import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, videoId } = body;

    if (!userId || !videoId) {
      return NextResponse.json(
        { error: 'userId and videoId are required' },
        { status: 400 }
      );
    }

    // Создаем или обновляем запись TrainingSession для обычного просмотра
    // Если уже есть запись для этого видео и пользователя, обновляем createdAt
    const existingSession = await prisma.trainingSession.findFirst({
      where: {
        userId,
        videoId,
      },
    });

    if (existingSession) {
      // Обновляем время просмотра
      await prisma.trainingSession.update({
        where: {
          id: existingSession.id,
        },
        data: {
          createdAt: new Date(),
        },
      });
    } else {
      // Создаем новую запись
      await prisma.trainingSession.create({
        data: {
          userId,
          videoId,
          completed: false,
          progress: 0,
        },
      });
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error('Error recording video watch:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
