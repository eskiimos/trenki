import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@/generated/prisma';
import { requireAdminAsync } from '@/lib/admin-session';
import { logger } from '@/lib/logger';
import { MAX_SEGMENTS, parseSegments } from '@/lib/pose/segments';

export const dynamic = 'force-dynamic';

/**
 * PUT /api/admin/pose-references/[videoId]/segments — рабочие отрезки эталона
 * (упражнение без объяснений и пауз), поправленные админом на таймлайне.
 * Body: { segments: [{ startMs, endMs }] }. Только админ.
 */
export async function PUT(request: NextRequest, ctx: { params: Promise<{ videoId: string }> }) {
  const denied = await requireAdminAsync(request);
  if (denied) return denied;
  const { videoId } = await ctx.params;

  const reference = await prisma.poseReference.findUnique({
    where: { videoId },
    select: { durationSec: true },
  });
  if (!reference) return NextResponse.json({ error: 'Эталона нет' }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const segments = parseSegments(body?.segments, Math.round(reference.durationSec * 1000));
  if (!segments) {
    return NextResponse.json(
      { error: `Неверная разметка (отрезков не больше ${MAX_SEGMENTS}, время — числа)` },
      { status: 400 },
    );
  }

  try {
    const saved = await prisma.$transaction(async (tx) => {
      // Share the background writer's lock so an edit cannot be lost at publication.
      await tx.$queryRaw`SELECT id FROM videos WHERE id = ${videoId} FOR UPDATE`;
      const current = await tx.poseReference.findUnique({ where: { videoId }, select: { durationSec: true } });
      if (!current) return null;
      const normalized = parseSegments(body.segments, Math.round(current.durationSec * 1000))!;
      await tx.poseReference.update({
        where: { videoId },
        data: { segments: normalized as unknown as Prisma.InputJsonValue },
      });
      return normalized;
    });
    if (!saved) return NextResponse.json({ error: 'Эталона нет' }, { status: 404 });
    logger.info('pose reference segments saved', { videoId, segments: saved.length });
    return NextResponse.json({ segments: saved });
  } catch (error) {
    logger.error('pose reference segments save failed', error, { videoId });
    return NextResponse.json({ error: 'Не удалось сохранить разметку' }, { status: 500 });
  }
}
