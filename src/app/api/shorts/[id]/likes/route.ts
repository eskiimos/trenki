import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { updateUserActivity } from '@/lib/updateUserActivity';
import { requireAuthUser } from '@/lib/coach/guards';

// GET - Получить все лайки для short (публичное, без auth)
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
    const auth = await requireAuthUser(request);
    if ('response' in auth) return auth.response;
    const userId = auth.user.id;

    const { id: shortId } = await context.params;

    // Идемпотентный toggle: deleteMany/createMany(skipDuplicates) НЕ бросают на
    // гонках (P2025/P2002), поэтому быстрые повторные тапы безопасны (не 500).
    const existingLike = await prisma.shortLike.findUnique({
      where: { userId_shortId: { userId, shortId } }
    });

    let isLiked: boolean;
    if (existingLike) {
      await prisma.shortLike.deleteMany({ where: { userId, shortId } });
      isLiked = false;
    } else {
      await prisma.shortLike.createMany({ data: [{ userId, shortId }], skipDuplicates: true });
      isLiked = true;
    }

    // Счётчик пересчитываем из ИСТИНЫ (COUNT), чтобы денормализованный likesCount
    // не дрейфовал при конкурентных запросах.
    const likesCount = await prisma.shortLike.count({ where: { shortId } });
    await prisma.short.update({ where: { id: shortId }, data: { likesCount } });

    await updateUserActivity(userId);

    return NextResponse.json({ success: true, isLiked, likesCount });
  } catch (error) {
    console.error('Error toggling like:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Убрать лайк (теперь дублирует POST-toggle, оставлен для обратной совместимости)
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuthUser(request);
    if ('response' in auth) return auth.response;
    const userId = auth.user.id;

    const { id: shortId } = await context.params;

    await prisma.shortLike.deleteMany({ where: { userId, shortId } });
    // Пересчёт из истины — без слепого decrement (не даём счётчику уйти в минус/дрейф).
    const likesCount = await prisma.shortLike.count({ where: { shortId } });
    await prisma.short.update({ where: { id: shortId }, data: { likesCount } });

    return NextResponse.json({ success: true, likesCount });
  } catch (error) {
    console.error('Error deleting like:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
