import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { updateUserActivity } from '@/lib/updateUserActivity';
import { requireAuthUser } from '@/lib/coach/guards';

// GET - проверить, лайкнул ли пользователь видео
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuthUser(request);
    if ('response' in auth) return auth.response;

    const { id: videoId } = await params;

    const like = await prisma.videoLike.findUnique({
      where: {
        userId_videoId: {
          userId: auth.user.id,
          videoId,
        },
      },
    });

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
    const auth = await requireAuthUser(request);
    if ('response' in auth) return auth.response;
    const userId = auth.user.id;

    const { id: videoId } = await params;

    const video = await prisma.video.findUnique({
      where: { id: videoId },
    });

    if (!video) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    const existingLike = await prisma.videoLike.findUnique({
      where: { userId_videoId: { userId, videoId } },
    });

    let isLiked: boolean;
    let likesCount: number;

    if (existingLike) {
      await prisma.$transaction([
        prisma.videoLike.delete({
          where: { userId_videoId: { userId, videoId } },
        }),
        prisma.video.update({
          where: { id: videoId },
          data: { likesCount: { decrement: 1 } },
        }),
      ]);
      isLiked = false;
      likesCount = video.likesCount - 1;
    } else {
      await prisma.$transaction([
        prisma.videoLike.create({
          data: { userId, videoId },
        }),
        prisma.video.update({
          where: { id: videoId },
          data: { likesCount: { increment: 1 } },
        }),
      ]);
      isLiked = true;
      likesCount = video.likesCount + 1;
    }

    await updateUserActivity(userId);

    return NextResponse.json({ isLiked, likesCount });
  } catch (error) {
    console.error('Error toggling like:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
