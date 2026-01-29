import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Функция для форматирования продолжительности в YouTube формате (MM:SS или H:MM:SS)
function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '0:00';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
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
        videoTags: {
          include: {
            tag: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Извлекаем LoadType тег из videoTags
    const getLoadType = (videoTags: any[]) => {
      const loadTypeTag = videoTags.find(vt => vt.tag.tagType === 'LOAD');
      return loadTypeTag?.tag.loadType || null;
    };

    // Форматируем данные для фронтенда
    const formattedVideos = videos.map(video => ({
      id: video.id,
      title: video.title,
      description: video.description,
      duration: video.duration, // Число для админки
      durationFormatted: formatDuration(video.duration), // Строка для отображения
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
      rpeMin: video.rpeMin,
      rpeMax: video.rpeMax,
      // Новые поля для алгоритма - берем напрямую из video, не из тегов
      loadType: video.loadType || getLoadType(video.videoTags), // сначала поле, потом fallback на теги
      moduleType: video.moduleType,
      complexity: video.complexity,
      muscleGroup: video.muscleGroup,
      ageGroups: video.ageGroups,
      trainingGoals: video.trainingGoals,
    }));

    return NextResponse.json({ videos: formattedVideos });
  } catch (error) {
    console.error('Error fetching all videos:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
