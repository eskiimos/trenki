import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET - Получить все лайки для short
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    
    const likes = await prisma.shortLike.findMany({
      where: { shortId: id },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const likesCount = await prisma.shortLike.count({
      where: { shortId: id }
    });

    return NextResponse.json({ likes, likesCount });
  } catch (error) {
    console.error('Error fetching likes:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Поставить лайк
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: shortId } = await context.params;
    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    // Проверяем, существует ли уже лайк
    const existingLike = await prisma.shortLike.findUnique({
      where: {
        userId_shortId: {
          userId,
          shortId
        }
      }
    });

    if (existingLike) {
      return NextResponse.json({ error: 'Already liked' }, { status: 400 });
    }

    // Создаём лайк
    const like = await prisma.shortLike.create({
      data: {
        userId,
        shortId
      }
    });

    // Обновляем счётчик лайков в short
    await prisma.short.update({
      where: { id: shortId },
      data: {
        likesCount: {
          increment: 1
        }
      }
    });

    return NextResponse.json({ like, success: true });
  } catch (error) {
    console.error('Error creating like:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Убрать лайк
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: shortId } = await context.params;
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    // Удаляем лайк
    await prisma.shortLike.delete({
      where: {
        userId_shortId: {
          userId,
          shortId
        }
      }
    });

    // Обновляем счётчик лайков в short
    await prisma.short.update({
      where: { id: shortId },
      data: {
        likesCount: {
          decrement: 1
        }
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting like:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
