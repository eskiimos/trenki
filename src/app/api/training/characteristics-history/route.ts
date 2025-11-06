import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const limit = parseInt(searchParams.get('limit') || '10');

    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 });
    }

    // Получаем пользователя с профилем
    const user = await prisma.user.findUnique({
      where: { telegramId: userId },
      include: {
        profile: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Получаем последние завершенные тренировки
    const sessions = await prisma.workoutSession.findMany({
      where: {
        userId: user.id,
        status: 'COMPLETED',
        completedAt: { not: null },
      },
      orderBy: {
        completedAt: 'desc',
      },
      take: limit,
      include: {
        videos: {
          include: {
            video: {
              include: {
                videoTags: {
                  include: {
                    tag: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    // Для каждой тренировки нужно вычислить характеристики НА МОМЕНТ завершения
    // Но у нас нет истории характеристик... Нужно добавить таблицу CharacteristicHistory

    // Пока вернем текущие характеристики и список тренировок
    const workoutsWithGains = sessions.map((session) => {
      // Собираем LoadType теги из всех видео сессии
      const loadTypes: string[] = [];
      session.videos.forEach((sv) => {
        sv.video.videoTags.forEach((vt) => {
          if (vt.tag.tagType === 'LOAD' && vt.tag.loadType) {
            loadTypes.push(vt.tag.loadType);
          }
        });
      });

      return {
        id: session.id,
        completedAt: session.completedAt,
        duration: session.actualDuration || session.targetDuration,
        modulesCount: session.videos.length,
        loadTypes: Array.from(new Set(loadTypes)), // Уникальные
      };
    });

    // Текущие характеристики
    const currentCharacteristics = {
      ratingPower: user.profile?.ratingPower || 0,
      ratingSpeed: user.profile?.ratingSpeed || 0,
      ratingEndurance: user.profile?.ratingEndurance || 0,
      ratingTechnique: user.profile?.ratingTechnique || 0,
      ratingFlexibility: user.profile?.ratingFlexibility || 0,
      potential: user.profile?.potential || 0,
    };

    return NextResponse.json({
      success: true,
      currentCharacteristics,
      workouts: workoutsWithGains,
      totalWorkouts: sessions.length,
    });
  } catch (error) {
    console.error('Error fetching characteristics history:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
