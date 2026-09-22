import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminAsync } from '@/lib/admin-session';
import { logger } from '@/lib/logger';
import { loadReferenceFrames } from '@/lib/pose/reference-storage';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/pose-references/[videoId]/frames — кадры эталона (gzip JSON)
 * через наш сервер из закрытого S3 (pose/references/…).
 * Клиент распаковывает сам (DecompressionStream). Только админ.
 */
export async function GET(request: NextRequest, ctx: { params: Promise<{ videoId: string }> }) {
  const denied = await requireAdminAsync(request);
  if (denied) return denied;
  const { videoId } = await ctx.params;
  const ref = await prisma.poseReference.findUnique({ where: { videoId }, select: { framesUrl: true } });
  if (!ref) return NextResponse.json({ error: 'Эталона нет' }, { status: 404 });
  try {
    const buf = await loadReferenceFrames(ref.framesUrl);
    return new Response(new Uint8Array(buf), {
      headers: { 'Content-Type': 'application/gzip', 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    logger.error('pose reference frames load failed', error, { videoId });
    return NextResponse.json({ error: 'Не удалось загрузить эталон' }, { status: 502 });
  }
}
