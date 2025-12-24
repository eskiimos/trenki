import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET - получить рекомендованные shorts
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const excludeIds = searchParams.getAll('exclude'); // IDs для исключения
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Базовое получение shorts с исключением просмотренных
    const shorts = await prisma.short.findMany({
      where: {
        isPublished: true,
        ...(excludeIds.length > 0 && { id: { notIn: excludeIds } })
      },
      orderBy: [
        { viewsCount: 'desc' }, // Сначала популярные
        { createdAt: 'desc' }   // Потом новые
      ],
      skip: offset,
      take: limit
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

    return NextResponse.json({ 
      shorts: shortsWithData,
      total: shorts.length,
      offset,
      limit
    });
  } catch (error) {
    console.error('Error fetching recommendations:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
