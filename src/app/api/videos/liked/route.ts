import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuthUser } from '@/lib/coach/guards';

/**
 * GET /api/videos/liked
 *
 * Лайкнутые занятия каталога — «избранные занятия» (решение владельца:
 * лайк = избранное, как у шортсов; отдельную звезду не заводим, мёртвую
 * модель FavoriteVideo не оживляем).
 *
 * videoUrl НЕ отдаём: играбельный URL выдаёт гейтированный /api/videos/[id]
 * (paywall + presigned для s3://), карточке достаточно превью.
 */
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuthUser(request);
    if ('response' in auth) return auth.response;

    const likes = await prisma.videoLike.findMany({
      where: {
        userId: auth.user.id,
        // Снятые с публикации не показываем: тап вёл бы в никуда
        video: { isPublished: true },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        createdAt: true,
        video: {
          select: {
            id: true,
            title: true,
            thumbnail: true,
            duration: true,
            category: true,
            trainer: { select: { name: true, lastName: true } },
          },
        },
      },
    });

    return NextResponse.json({
      videos: likes.map((l) => ({
        id: l.video.id,
        title: l.video.title,
        thumbnail: l.video.thumbnail,
        duration: l.video.duration,
        category: l.video.category,
        trainer: `${l.video.trainer.name} ${l.video.trainer.lastName}`.trim(),
        likedAt: l.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error('Error fetching liked videos:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
