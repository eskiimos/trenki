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
    await prisma.poseReference.update({
      where: { videoId },
      data: { segments: segments as unknown as Prisma.InputJsonValue },
    });
    logger.info('pose reference segments saved', { videoId, segments: segments.length });
    return NextResponse.json({ segments });
  } catch (error) {
    logger.error('pose reference segments save failed', error, { videoId });
    return NextResponse.json({ error: 'Не удалось сохранить разметку' }, { status: 500 });
  }
}
