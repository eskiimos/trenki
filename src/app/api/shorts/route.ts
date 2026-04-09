import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { updateUserActivity } from '@/lib/updateUserActivity';

// GET - получить все опубликованные shorts
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const trainerId = searchParams.get('trainerId');
    const audience = searchParams.get('audience'); // HOCKEY | ADAPTIVE
    
    const whereClause: any = {
      isPublished: true,
    };

    // Фильтр по аудитории
    if (audience === 'ADAPTIVE') {
      whereClause.audience = { in: ['ADAPTIVE', 'ALL'] };
    } else if (audience === 'HOCKEY') {
      whereClause.audience = { in: ['HOCKEY', 'ALL'] };
    }

    // Фильтр по тренеру
    if (trainerId) {
      whereClause.trainerId = trainerId;
    }
    
    const shorts = await prisma.short.findMany({
      where: whereClause,
      orderBy: [
        { order: 'asc' },
        { createdAt: 'desc' }
      ]
    });

    // Загружаем данные тренеров и статусы лайков
    const shortsWithData = await Promise.all(
      shorts.map(async (short) => {
        let trainer = null;
        if (short.trainerId) {
          trainer = await prisma.trainer.findUnique({
            where: { id: short.trainerId },
            select: {
              id: true,
              name: true,
              lastName: true,
              avatar: true,
            }
          });
        }

        // Проверяем статус лайка
        let isLiked = false;
        if (userId) {
          const user = await prisma.user.findUnique({
            where: { telegramId: userId }
          });

          if (user) {
            const like = await prisma.shortLike.findUnique({
              where: {
                userId_shortId: {
                  userId: user.id,
                  shortId: short.id
                }
              }
            });
            isLiked = !!like;
          }
        }

        // Получаем количество комментариев
        const commentsCount = await prisma.shortComment.count({
          where: { shortId: short.id }
        });

        return { 
          ...short, 
          trainer,
          isLiked,
          commentsCount
        };
      })
    );

    // Обновляем активность пользователя, если он авторизован
    if (userId) {
      await updateUserActivity(userId);
    }

    return NextResponse.json({ shorts: shortsWithData });
  } catch (error) {
    console.error('Error fetching shorts:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - создать новый short
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('Received short body:', body);

    const short = await prisma.short.create({
      data: {
        title: body.title,
        description: body.description || '',
        videoUrl: body.videoUrl,
        thumbnail: body.thumbnail || '',
        trainerId: body.trainerId || null,
        tags: body.tags || [],
        isPublished: body.isPublished ?? true,
        order: body.order || 0,
        audience: body.audience || 'HOCKEY',
      },
    });

    console.log('Created short:', short);

    return NextResponse.json({ short });
  } catch (error: any) {
    console.error('Error creating short:', error);
    return NextResponse.json({ 
      error: 'Failed to create short',
      details: error.message 
    }, { status: 500 });
  }
}
