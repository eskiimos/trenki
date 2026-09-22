import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminAsync } from '@/lib/admin-session';
import { logger } from '@/lib/logger';
import { REFERENCE_ELIGIBLE_WHERE } from '@/lib/pose/reference-source';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/pose-references — видео, которые можно обработать как эталон
 * движений (файл в нашем хранилище), и статус эталона. Только админ.
 */
export async function GET(request: NextRequest) {
  const denied = await requireAdminAsync(request);
  if (denied) return denied;
  try {
    const videos = await prisma.video.findMany({
      where: REFERENCE_ELIGIBLE_WHERE,
      orderBy: { createdAt: 'desc' },
      take: 300,
      select: {
        id: true,
        title: true,
        duration: true,
        thumbnail: true,
        isPublished: true,
        trainer: { select: { name: true, lastName: true } },
        poseReference: {
          select: { updatedAt: true, detectedRatio: true, legsVisibleRatio: true, frameCount: true, model: true },
        },
      },
    });
    return NextResponse.json({ videos });
  } catch (error) {
    logger.error('admin/pose-references GET failed', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
