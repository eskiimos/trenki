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
 * Body: { segments: [{ startMs, endMs, assessment? }], expectedUpdatedAt? }. Только админ.
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
  if (body?.expectedUpdatedAt !== undefined && (typeof body.expectedUpdatedAt !== 'string' || !Number.isFinite(Date.parse(body.expectedUpdatedAt)))) {
    return NextResponse.json({ error: 'Неверная версия эталона' }, { status: 400 });
  }
  const segments = parseSegments(body?.segments, Math.round(reference.durationSec * 1000));
  if (!segments) {
    return NextResponse.json(
      { error: `Неверная разметка или настройки оценки (отрезков не больше ${MAX_SEGMENTS}, разные профили не должны пересекаться)` },
      { status: 400 },
    );
  }

  try {
    const saved = await prisma.$transaction(async (tx) => {
      // Share the background writer's lock so an edit cannot be lost at publication.
      await tx.$queryRaw`SELECT id FROM videos WHERE id = ${videoId} FOR UPDATE`;
      const current = await tx.poseReference.findUnique({ where: { videoId }, select: { durationSec: true, updatedAt: true } });
      if (!current) return null;
      if (body.expectedUpdatedAt !== undefined && current.updatedAt.toISOString() !== body.expectedUpdatedAt) return { conflict: true } as const;
      const normalized = parseSegments(body.segments, Math.round(current.durationSec * 1000));
      if (!normalized) return { invalid: true } as const;
      const updated = await tx.poseReference.update({
        where: { videoId },
        data: { segments: normalized as unknown as Prisma.InputJsonValue },
        select: { updatedAt: true },
      });
      return { segments: normalized, updatedAt: updated.updatedAt };
    });
    if (!saved) return NextResponse.json({ error: 'Эталона нет' }, { status: 404 });
    if ('conflict' in saved) return NextResponse.json({ error: 'Эталон или разметка уже изменились. Обновите страницу перед сохранением.' }, { status: 409 });
    if ('invalid' in saved) return NextResponse.json({ error: 'Разметка не подходит к актуальному эталону' }, { status: 400 });
    logger.info('pose reference segments saved', { videoId, segments: saved.segments.length });
    return NextResponse.json(saved);
  } catch (error) {
    logger.error('pose reference segments save failed', error, { videoId });
    return NextResponse.json({ error: 'Не удалось сохранить разметку' }, { status: 500 });
  }
}
