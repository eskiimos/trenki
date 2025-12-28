import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const trainers = await prisma.trainer.findMany({
      include: {
        videos: {
          select: {
            id: true,
            duration: true
          },
          where: {
            isPublished: true // Считаем только опубликованные видео
          }
        }
      },
      orderBy: { rating: 'desc' }
    });

    // Вычисляем статистику для каждого тренера
    const trainersWithStats = trainers.map(trainer => {
      const shortVideos = trainer.videos.filter(v => v.duration < 600).length; // < 10 минут = Тренеки
      const longVideos = trainer.videos.filter(v => v.duration >= 600).length; // >= 10 минут = Тренировки
      
      return {
        ...trainer,
        videos: trainer.videos, // Возвращаем массив для совместимости
        shortVideosCount: shortVideos,
        longVideosCount: longVideos
      };
    });

    return NextResponse.json({ trainers: trainersWithStats });
  } catch (error) {
    console.error('Error fetching trainers:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, lastName, speciality, experience, avatar, description } = body;

    if (!name || !lastName || !speciality) {
      return NextResponse.json({ 
        error: 'name, lastName, and speciality are required' 
      }, { status: 400 });
    }

    const trainer = await prisma.trainer.create({
      data: {
        name,
        lastName,
        speciality,
        experience: experience || 0,
        avatar,
        description
      }
    });

    return NextResponse.json({ trainer });
  } catch (error) {
    console.error('Error creating trainer:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
