import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminAsync } from '@/lib/admin-session';
import { getSessionUserId } from '@/lib/auth-server';

// GET - получить short по ID (публичное, isLiked при наличии сессии)
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const sessionUserId = await getSessionUserId(request);
    const { id } = await context.params;

    const short = await prisma.short.findUnique({
      where: { id },
    });

    if (!short) {
      return NextResponse.json({ error: 'Short not found' }, { status: 404 });
    }

    let trainer = null;
    if (short.trainerId) {
      trainer = await prisma.trainer.findUnique({
        where: { id: short.trainerId },
        select: { id: true, name: true, lastName: true, avatar: true }
      });
    }

    let isLiked = false;
    if (sessionUserId) {
      const like = await prisma.shortLike.findUnique({
        where: {
          userId_shortId: { userId: sessionUserId, shortId: id }
        }
      });
      isLiked = !!like;
    }

    const commentsCount = await prisma.shortComment.count({
      where: { shortId: id }
    });

    return NextResponse.json({
      short: { ...short, trainer, isLiked, commentsCount }
    });
  } catch (error) {
    console.error('Error fetching short:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - обновить short
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const denied = await requireAdminAsync(request);
  if (denied) return denied;
  try {
    const { id } = await context.params;
    const body = await request.json();

    const short = await prisma.short.update({
      where: { id },
      data: {
        title: body.title,
        description: body.description,
        videoUrl: body.videoUrl,
        thumbnail: body.thumbnail,
        trainerId: body.trainerId || null,
        tags: body.tags || [],
        isPublished: body.isPublished,
        order: body.order,
        audience: body.audience || undefined,
      },
    });

    return NextResponse.json({ short });
  } catch (error: any) {
    console.error('Error updating short:', error);
    return NextResponse.json({ 
      error: 'Failed to update short',
    }, { status: 500 });
  }
}

// DELETE - удалить short
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const denied = await requireAdminAsync(request);
  if (denied) return denied;
  try {
    const { id } = await context.params;

    await prisma.short.delete({
      where: { id },
    });

    return NextResponse.json({ message: 'Short deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting short:', error);
    return NextResponse.json({ 
      error: 'Failed to delete short',
    }, { status: 500 });
  }
}

// PATCH - обновить счетчик просмотров или другие метрики
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await request.json();

    if (body.action === 'incrementViews') {
      const short = await prisma.short.update({
        where: { id },
        data: {
          viewsCount: {
            increment: 1
          }
        },
      });

      return NextResponse.json({ 
        success: true,
        viewsCount: short.viewsCount 
      });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error: any) {
    console.error('Error patching short:', error);
    return NextResponse.json({ 
      error: 'Failed to patch short',
    }, { status: 500 });
  }
}
