import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuthUser } from '@/lib/coach/guards';

/**
 * GET /api/shorts/liked
 *
 * Лайкнутые шортсы текущего пользователя — «избранные треньки» (решение
 * владельца: лайк = избранное, отдельной сущности не заводим). Показываются
 * во вкладке «Избранное» экрана «История и избранное».
 *
 * Ответ: { shorts: [{ id, title, thumbnail, likedAt }] }
 */
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuthUser(request);
    if ('response' in auth) return auth.response;

    const likes = await prisma.shortLike.findMany({
      where: {
        userId: auth.user.id,
        // Снятые с публикации не показываем: тап вёл бы на 404
        short: { isPublished: true },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        createdAt: true,
        short: { select: { id: true, title: true, thumbnail: true } },
      },
    });

    return NextResponse.json({
      shorts: likes.map((l) => ({
        id: l.short.id,
        title: l.short.title,
        thumbnail: l.short.thumbnail,
        likedAt: l.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error('Error fetching liked shorts:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
