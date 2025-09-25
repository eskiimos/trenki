import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/trainers/[id] - Получение данных одного тренера
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    if (!id) {
      return NextResponse.json({ error: 'Trainer ID is required' }, { status: 400 });
    }

    const trainer = await prisma.trainer.findUnique({
      where: { id },
      include: {
        videos: {
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!trainer) {
      return NextResponse.json({ error: 'Trainer not found' }, { status: 404 });
    }

    // Подсчет статистики тренера
    const videosCount = trainer.videos.length;
    
    // Количество тренировок = сумма просмотров всех видео
    const trainingSessions = await prisma.trainingSession.count({
      where: {
        video: {
          trainerId: id
        }
      }
    });

    return NextResponse.json({ 
      trainer,
      stats: {
        videosCount,
        trainingSessions,
        experience: trainer.experience
      }
    });
  } catch (error) {
    console.error('Error fetching trainer:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}