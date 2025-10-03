import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Функция для форматирования продолжительности (секунды -> мм:сс)
function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

export async function GET(request: NextRequest) {
  try {
    // Получаем ВСЕ видео, включая неопубликованные
    const videos = await prisma.video.findMany({
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
      isPublished: video.isPublished,
      trainer: {
        id: video.trainer.id,
        name: `${video.trainer.name} ${video.trainer.lastName}`,
        avatar: video.trainer.avatar || '/images/avatars/trainer-avatar-1.png',
        speciality: video.trainer.speciality,
      },
      createdAt: video.createdAt,
    }));

    return NextResponse.json({ videos: formattedVideos });
  } catch (error) {
    console.error('Error fetching all videos:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
