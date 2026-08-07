import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { updateUserActivity } from '@/lib/updateUserActivity';
import { requireAuthUser } from '@/lib/coach/guards';

// Комментарии к видео — зеркало /api/shorts/[id]/comments.

const MAX_COMMENT_LENGTH = 500;

// GET - Получить все комментарии для видео (публичное, без auth)
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    const comments = await prisma.videoComment.findMany({
      where: { videoId: id },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            profile: {
              select: { avatarUrl: true }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({ comments, commentsCount: comments.length });
  } catch (error) {
    console.error('Error fetching video comments:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Добавить комментарий
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuthUser(request);
    if ('response' in auth) return auth.response;
    const userId = auth.user.id;

    const { id: videoId } = await context.params;
    const body = await request.json();
    const text: string = typeof body?.text === 'string' ? body.text : '';
    const trimmed = text.trim();

    if (trimmed.length === 0) {
      return NextResponse.json({ error: 'Comment cannot be empty' }, { status: 400 });
    }
    if (trimmed.length > MAX_COMMENT_LENGTH) {
      return NextResponse.json({ error: 'Comment is too long' }, { status: 400 });
    }

    const video = await prisma.video.findUnique({
      where: { id: videoId },
      select: { id: true }
    });
    if (!video) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    const comment = await prisma.videoComment.create({
      data: {
        userId,
        videoId,
        text: trimmed
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            profile: {
              select: { avatarUrl: true }
            }
          }
        }
      }
    });

    await updateUserActivity(userId);

    return NextResponse.json({ comment, success: true });
  } catch (error) {
    console.error('Error creating video comment:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
