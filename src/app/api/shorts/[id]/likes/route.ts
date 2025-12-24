import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { updateUserActivity } from '@/lib/updateUserActivity';

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

// POST - Toggle лайк (поставить или убрать)
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: shortId } = await context.params;
    const telegramId = request.headers.get('X-Telegram-User-ID');

    if (!telegramId) {
      return NextResponse.json({ error: 'Telegram ID is required' }, { status: 400 });
    }

    // Находим или создаём пользователя по telegramId
    let user = await prisma.user.findUnique({
      where: { telegramId }
    });

    if (!user) {
      // Создаём нового пользователя с профилем
      user = await prisma.user.create({
        data: {
          telegramId,
          firstName: 'User',
          profile: {
            create: {
              strength: 0,
              endurance: 0,
              speed: 0,
              technique: 0,
              skating: 0,
              shooting: 0,
              passing: 0,
              checking: 0,
              overall: 0,
            }
          }
        },
        include: {
          profile: true
        }
      });
    }

    // Проверяем, существует ли уже лайк
    const existingLike = await prisma.shortLike.findUnique({
      where: {
        userId_shortId: {
          userId: user.id,
          shortId
        }
      }
    });

    let isLiked: boolean;
    let short;

    if (existingLike) {
      // Убираем лайк
      await prisma.shortLike.delete({
        where: {
          userId_shortId: {
            userId: user.id,
            shortId
          }
        }
      });

      // Обновляем счётчик
      short = await prisma.short.update({
        where: { id: shortId },
        data: {
          likesCount: {
            decrement: 1
          }
        }
      });

      isLiked = false;
    } else {
      // Создаём лайк
      await prisma.shortLike.create({
        data: {
          userId: user.id,
          shortId
        }
      });

      // Обновляем счётчик
      short = await prisma.short.update({
        where: { id: shortId },
        data: {
          likesCount: {
            increment: 1
          }
        }
      });

      isLiked = true;
    }

    // Обновляем активность пользователя
    await updateUserActivity(telegramId);

    return NextResponse.json({ 
      success: true,
      isLiked,
      likesCount: short.likesCount
    });
  } catch (error) {
    console.error('Error toggling like:', error);
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
    const telegramId = searchParams.get('userId');

    if (!telegramId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    // Находим пользователя по telegramId
    const user = await prisma.user.findUnique({
      where: { telegramId }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Удаляем лайк с внутренним userId
    await prisma.shortLike.delete({
      where: {
        userId_shortId: {
          userId: user.id,
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
