import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuthUser } from '@/lib/coach/guards';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuthUser(request);
    if ('response' in auth) return auth.response;
    const userId = auth.user.id;

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');

    // Получаем последние просмотренные видео из TrainingSession
    const watchHistory = await prisma.trainingSession.findMany({
      where: {
        userId,
      },
      include: {
        video: {
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
            },
            _count: {
              select: {
                likes: true,
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: limit
    });

    // Форматируем видео данные
    const formattedHistory = watchHistory.map(session => {
      const video = session.video;
      
      // Extract load types from video tags
      const loadTypes = video.videoTags
        .filter(vt => vt.tag.tagType === 'LOAD' && vt.tag.loadType)
        .map(vt => vt.tag.loadType);

      return {
        id: video.id,
        title: video.title,
        description: video.description,
        duration: video.duration,
        videoUrl: video.videoUrl,
        thumbnail: video.thumbnail,
        category: video.category,
        difficulty: video.difficulty,
        tags: video.tags,
        loadTypes,
        equipment: video.equipment,
        level: video.level,
        viewsCount: video.viewsCount,
        likesCount: video._count.likes,
        trainer: {
          id: video.trainer.id,
          name: video.trainer.name,
          lastName: video.trainer.lastName,
          avatar: video.trainer.avatar || '/images/avatars/trainer-avatar-1.png',
          speciality: video.trainer.speciality,
        },
        createdAt: video.createdAt,
        watchedAt: session.createdAt,
        isPublished: video.isPublished,
        rpeMin: video.rpeMin,
        rpeMax: video.rpeMax,
      };
    });

    return NextResponse.json({
      videos: formattedHistory,
      total: formattedHistory.length
    });
  } catch (error) {
    console.error('Error fetching watch history:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
