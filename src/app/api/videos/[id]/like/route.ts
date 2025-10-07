import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// GET - проверить, лайкнул ли пользователь видео
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: videoId } = await params;
    const telegramId = request.headers.get('X-Telegram-User-ID');

    if (!telegramId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Находим пользователя
    const user = await prisma.user.findUnique({
      where: { telegramId },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Проверяем наличие лайка
    const like = await prisma.videoLike.findUnique({
      where: {
        userId_videoId: {
          userId: user.id,
          videoId,
        },
      },
    });

    // Получаем общее количество лайков
    const video = await prisma.video.findUnique({
      where: { id: videoId },
      select: { likesCount: true },
    });

    return NextResponse.json({
      isLiked: !!like,
      likesCount: video?.likesCount || 0,
    });
  } catch (error) {
    console.error('Error checking like:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - поставить/убрать лайк
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: videoId } = await params;
    const telegramId = request.headers.get('X-Telegram-User-ID');

    if (!telegramId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Находим пользователя
    const user = await prisma.user.findUnique({
      where: { telegramId },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Проверяем существование видео
    const video = await prisma.video.findUnique({
      where: { id: videoId },
    });

    if (!video) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    // Проверяем наличие лайка
    const existingLike = await prisma.videoLike.findUnique({
      where: {
        userId_videoId: {
          userId: user.id,
          videoId,
        },
      },
    });

    let isLiked: boolean;
    let likesCount: number;

    if (existingLike) {
      // Убираем лайк
      await prisma.$transaction([
        prisma.videoLike.delete({
          where: {
            userId_videoId: {
              userId: user.id,
              videoId,
            },
          },
        }),
        prisma.video.update({
          where: { id: videoId },
          data: { likesCount: { decrement: 1 } },
        }),
      ]);
      isLiked = false;
      likesCount = video.likesCount - 1;
    } else {
      // Ставим лайк
      await prisma.$transaction([
        prisma.videoLike.create({
          data: {
            userId: user.id,
            videoId,
          },
        }),
        prisma.video.update({
          where: { id: videoId },
          data: { likesCount: { increment: 1 } },
        }),
      ]);
      isLiked = true;
      likesCount = video.likesCount + 1;
    }

    return NextResponse.json({ isLiked, likesCount });
  } catch (error) {
    console.error('Error toggling like:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
