import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminAsync } from '@/lib/admin-session';
import { openObjectStream } from '@/lib/s3';
import { logger } from '@/lib/logger';
import { referenceSource } from '@/lib/pose/reference-source';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/pose-references/[videoId]/source — файл видео через наш домен
 * для обработки в браузере админа. MediaPipe читает пиксели кадров, а видео с
 * чужого домена (S3) без CORS браузер читать не даёт. Потоком, без буфера.
 */
export async function GET(request: NextRequest, ctx: { params: Promise<{ videoId: string }> }) {
  const denied = await requireAdminAsync(request);
  if (denied) return denied;
  const { videoId } = await ctx.params;
  const video = await prisma.video.findUnique({ where: { id: videoId }, select: { videoUrl: true } });
  const source = referenceSource(video?.videoUrl);
  if (!source) return NextResponse.json({ error: 'Видео не найдено' }, { status: 404 });
  if (source.kind === 'local') return NextResponse.redirect(new URL(source.path, request.url));
  try {
    const obj = await openObjectStream(source.key, request.signal);
    return new Response(obj.body, {
      headers: {
        'Content-Type': obj.contentType || 'video/mp4',
        ...(obj.contentLength != null ? { 'Content-Length': String(obj.contentLength) } : {}),
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    logger.error('pose source stream failed', error, { videoId });
    return NextResponse.json({ error: 'Не удалось получить видео из хранилища' }, { status: 502 });
  }
}
