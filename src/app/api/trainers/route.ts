import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminAsync } from '@/lib/admin-session';
import { trainerExperienceYears, careerStartYearFromExperience } from '@/lib/trainer';

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
        },
        shorts: {
          select: {
            id: true
          },
          where: {
            isPublished: true // Считаем только опубликованные шорты
          }
        }
      },
      orderBy: { rating: 'desc' }
    });

    // Вычисляем статистику для каждого тренера
    const trainersWithStats = trainers.map(trainer => {
      const shortVideos = trainer.shorts.length; // Тренеки = Shorts (отдельная модель)
      const longVideos = trainer.videos.length; // Тренировки = Videos
      
      return {
        ...trainer,
        videos: trainer.videos, // Возвращаем массив для совместимости
        experience: trainerExperienceYears(trainer), // деривация из careerStartYear (растёт +1 каждый 1 января)
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
  const denied = await requireAdminAsync(request);
  if (denied) return denied;
  try {
    const body = await request.json();
    const { name, lastName, speciality, experience, rating, avatar, description } = body;

    if (!name || !lastName || !speciality) {
      return NextResponse.json({ 
        error: 'name, lastName, and speciality are required' 
      }, { status: 400 });
    }

    const expYears = Number(experience) || 0;
    const trainer = await prisma.trainer.create({
      data: {
        name,
        lastName,
        speciality,
        experience: expYears, // legacy-снимок
        careerStartYear: careerStartYearFromExperience(expYears), // источник истины
        rating: typeof rating === 'number' ? rating : 5.0,
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
