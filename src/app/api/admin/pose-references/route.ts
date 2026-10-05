import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@/generated/prisma';
import { requireAdminAsync } from '@/lib/admin-session';
import { logger } from '@/lib/logger';
import { referenceEligibleWhere, referenceSource } from '@/lib/pose/reference-source';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/pose-references — видео, которые можно обработать как эталон
 * движений (файл в нашем хранилище), и статус эталона. Только админ.
 */
export async function GET(request: NextRequest) {
  const denied = await requireAdminAsync(request);
  if (denied) return denied;
  const params = request.nextUrl.searchParams;
  const scope = params.get('scope') ?? 'all';
  if (!['all', 'references', 'library'].includes(scope)) {
    return NextResponse.json({ error: 'Неизвестный раздел списка' }, { status: 400 });
  }
  const query = (params.get('q') ?? '').trim().slice(0, 200);
  const cursor = params.get('cursor');
  const pageSize = 50;
  const where: Prisma.VideoWhereInput = {
    AND: [
      referenceEligibleWhere(scope === 'library'),
      ...(scope === 'references' ? [{ poseReference: { isNot: null } }] : []),
      ...query.split(/\s+/).filter(Boolean).map((word) => ({
        OR: [
          { title: { contains: word, mode: 'insensitive' as const } },
          { trainer: { is: { name: { contains: word, mode: 'insensitive' as const } } } },
          { trainer: { is: { lastName: { contains: word, mode: 'insensitive' as const } } } },
        ],
      })),
    ],
  };
  try {
    const videos = await prisma.video.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: pageSize + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        title: true,
        videoUrl: true,
        duration: true,
        thumbnail: true,
        isPublished: true,
        trainer: { select: { name: true, lastName: true } },
        poseReference: {
          select: { updatedAt: true, detectedRatio: true, legsVisibleRatio: true, frameCount: true, model: true },
        },
      },
    });
    const page = videos.slice(0, pageSize);
    return NextResponse.json({
      // Дополнительная проверка ключа после URL-decoding: raw uploads не
      // становятся доступными через публичный URL с закодированным префиксом.
      videos: page
        .filter((video) => {
          const source = referenceSource(video.videoUrl);
          return source && (scope !== 'library' || source.kind === 's3');
        })
        .map((video) => ({
          id: video.id,
          title: video.title,
          duration: video.duration,
          thumbnail: video.thumbnail,
          isPublished: video.isPublished,
          trainer: video.trainer,
          poseReference: video.poseReference,
        })),
      nextCursor: videos.length > pageSize ? page.at(-1)!.id : null,
    });
  } catch (error) {
    logger.error('admin/pose-references GET failed', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
