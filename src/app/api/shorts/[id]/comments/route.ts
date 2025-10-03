import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET - Получить все комментарии для short
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    
    const comments = await prisma.shortComment.findMany({
      where: { shortId: id },
      include: {
        user: {
          select: {
            id: true,
            telegramId: true,
            firstName: true,
            lastName: true,
            username: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const commentsCount = comments.length;

    return NextResponse.json({ comments, commentsCount });
  } catch (error) {
    console.error('Error fetching comments:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Добавить комментарий
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: shortId } = await context.params;
    const body = await request.json();
    const { userId: telegramId, text } = body;

    if (!telegramId || !text) {
      return NextResponse.json({ error: 'userId and text are required' }, { status: 400 });
    }

    if (text.trim().length === 0) {
      return NextResponse.json({ error: 'Comment cannot be empty' }, { status: 400 });
    }

    // Находим пользователя по telegramId
    const user = await prisma.user.findUnique({
      where: { telegramId }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Создаём комментарий с внутренним userId
    const comment = await prisma.shortComment.create({
      data: {
        userId: user.id,
        shortId,
        text: text.trim()
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true
          }
        }
      }
    });

    return NextResponse.json({ comment, success: true });
  } catch (error) {
    console.error('Error creating comment:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
