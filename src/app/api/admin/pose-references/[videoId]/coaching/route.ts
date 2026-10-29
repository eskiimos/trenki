import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminAsync } from '@/lib/admin-session';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/** Update video-level biomechanics even when the video has no pose reference. */
export async function PATCH(request: NextRequest, ctx: { params: Promise<{ videoId: string }> }) {
  const denied = await requireAdminAsync(request);
  if (denied) return denied;
  const { videoId } = await ctx.params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object' || Array.isArray(body)
    || !(body.trackingEnabled === null || typeof body.trackingEnabled === 'boolean')
    || typeof body.expectedUpdatedAt !== 'string' || !Number.isFinite(Date.parse(body.expectedUpdatedAt))) {
    return NextResponse.json({ error: 'Неверный режим биомеханики или версия видео' }, { status: 400 });
  }
  try {
    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM videos WHERE id = ${videoId} FOR UPDATE`;
      const current = await tx.video.findUnique({ where: { id: videoId }, select: { updatedAt: true } });
      if (!current) return null;
      if (current.updatedAt.toISOString() !== body.expectedUpdatedAt) return { conflict: true } as const;
      const saved = await tx.video.update({ where: { id: videoId }, data: { poseTrackingEnabled: body.trackingEnabled }, select: { poseTrackingEnabled: true, updatedAt: true } });
      return { trackingEnabled: saved.poseTrackingEnabled, updatedAt: saved.updatedAt };
    });
    if (!result) return NextResponse.json({ error: 'Видео не найдено' }, { status: 404 });
    if ('conflict' in result) return NextResponse.json({ error: 'Настройки видео изменились. Обновите страницу перед сохранением.' }, { status: 409 });
    logger.info('pose coaching settings saved', { videoId, trackingEnabled: result.trackingEnabled });
    return NextResponse.json(result);
  } catch (error) {
    logger.error('pose coaching settings save failed', error, { videoId });
    return NextResponse.json({ error: 'Не удалось сохранить настройки биомеханики' }, { status: 500 });
  }
}
