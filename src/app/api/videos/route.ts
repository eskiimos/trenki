import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const difficulty = searchParams.get('difficulty');
    const trainerId = searchParams.get('trainerId');

    const where: any = {
      isPublished: true, // показываем только опубликованные видео
    };
    
    if (category && category !== 'all') {
      where.category = category.toUpperCase();
    }
    if (difficulty) {
      where.difficulty = difficulty.toUpperCase();
    }
    if (trainerId) {
      where.trainerId = trainerId;
    }

    const videos = await prisma.video.findMany({
      where,
      include: {
        trainer: {
          select: {
            id: true,
            name: true,
            lastName: true,
            avatar: true,
            speciality: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' }
    });

    // Форматируем данные для фронтенда
    const formattedVideos = videos.map(video => ({
      id: video.id,
      title: video.title,
      description: video.description,
      duration: formatDuration(video.duration),
      videoUrl: video.videoUrl,
      thumbnail: video.thumbnail,
      category: video.category,
      difficulty: video.difficulty,
      tags: video.tags,
      equipment: video.equipment,
      level: video.level,
      viewsCount: video.viewsCount,
      trainer: {
        id: video.trainer.id,
        name: video.trainer.name,
        lastName: video.trainer.lastName,
        avatar: video.trainer.avatar || '/images/avatars/trainer-avatar-1.png',
        speciality: video.trainer.speciality,
      },
      createdAt: video.createdAt,
    }));

    return NextResponse.json({ videos: formattedVideos });
  } catch (error) {
    console.error('Error fetching videos:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Функция для форматирования продолжительности (секунды -> мм:сс)
function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('Received body:', body);
    
    const { 
      title, 
      description, 
      duration, 
      videoUrl, 
      thumbnail, 
      category, 
      difficulty, 
      trainerId,
      tags,
      equipment,
      level,
      isPublished 
    } = body;

    if (!title || !videoUrl || !category || !difficulty || !trainerId) {
      return NextResponse.json({ 
        error: 'title, videoUrl, category, difficulty, and trainerId are required' 
      }, { status: 400 });
    }

    // Преобразуем duration в число
    const durationNum = parseInt(duration) || 0;

    console.log('isPublished value:', isPublished, 'type:', typeof isPublished);

    const video = await prisma.video.create({
      data: {
        title,
        description,
        duration: durationNum,
        videoUrl,
        thumbnail: thumbnail || null,
        category,
        difficulty,
        trainerId,
        tags: tags || [],
        equipment: equipment || [],
        level: level || null,
        isPublished: isPublished ?? false,
      },
      include: {
        trainer: true
      }
    });

    console.log('Created video with isPublished:', video.isPublished);

    return NextResponse.json({ video });
  } catch (error: any) {
    console.error('Error creating video:', error);
    console.error('Error details:', error.message);
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error.message 
    }, { status: 500 });
  }
}
