import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminAsync } from '@/lib/admin-session';

// Модерация комментариев. Комментарии (к видео и к тренькам) публикуются сразу,
// поэтому «модерация» здесь = постмодерация: админ видит свежие и может удалить
// неуместные. Отзывы о тренерах модерируются отдельно (`/admin/reviews`).

const authorName = (u: { firstName: string | null; lastName: string | null; username: string | null }) =>
  [u.firstName, u.lastName].filter(Boolean).join(' ') || u.username || 'Без имени';

// GET — свежие комментарии обоих типов, слитые в одну ленту (новые сверху).
export async function GET(request: NextRequest) {
  const denied = await requireAdminAsync(request);
  if (denied) return denied;
  try {
    const take = 50;
    const userSelect = { firstName: true, lastName: true, username: true } as const;

    const [videoComments, shortComments] = await Promise.all([
      prisma.videoComment.findMany({
        take,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: userSelect }, video: { select: { id: true, title: true } } },
      }),
      prisma.shortComment.findMany({
        take,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: userSelect }, short: { select: { id: true, title: true } } },
      }),
    ]);

    const merged = [
      ...videoComments.map((c) => ({
        id: c.id,
        type: 'video' as const,
        text: c.text,
        createdAt: c.createdAt,
        author: authorName(c.user),
        target: { id: c.video.id, title: c.video.title },
      })),
      ...shortComments.map((c) => ({
        id: c.id,
        type: 'short' as const,
        text: c.text,
        createdAt: c.createdAt,
        author: authorName(c.user),
        target: { id: c.short.id, title: c.short.title },
      })),
    ]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, take);

    return NextResponse.json({ comments: merged });
  } catch (error) {
    console.error('Error fetching comments for moderation:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE — удалить комментарий. Тело: { type: 'video' | 'short', id: string }.
export async function DELETE(request: NextRequest) {
  const denied = await requireAdminAsync(request);
  if (denied) return denied;
  try {
    const { type, id } = await request.json();
    if ((type !== 'video' && type !== 'short') || typeof id !== 'string' || !id) {
      return NextResponse.json({ error: 'type ("video"|"short") и id обязательны' }, { status: 400 });
    }

    if (type === 'video') {
      await prisma.videoComment.delete({ where: { id } });
    } else {
      await prisma.shortComment.delete({ where: { id } });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting comment:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
