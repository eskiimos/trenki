import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuthUser } from '@/lib/coach/guards';

export const dynamic = 'force-dynamic';

/**
 * POST /api/pose-sessions
 * Атлет сохраняет результат сессии трекинга движений.
 * Body: { videoId, durationSec, framesCount, avgConfidence? }
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuthUser(request);
  if ('response' in auth) return auth.response;

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

  const videoId = String(body.videoId || '').trim();
  const durationSec = Math.max(0, Math.floor(Number(body.durationSec) || 0));
  const framesCount = Math.max(0, Math.floor(Number(body.framesCount) || 0));
  const avgConfidence =
    body.avgConfidence === undefined || body.avgConfidence === null
      ? null
      : Math.max(0, Math.min(1, Number(body.avgConfidence)));

  if (!videoId) return NextResponse.json({ error: 'videoId is required' }, { status: 400 });

  const video = await prisma.video.findUnique({ where: { id: videoId } });
  if (!video) return NextResponse.json({ error: 'Video not found' }, { status: 404 });

  const session = await prisma.poseSession.create({
    data: {
      athleteId: auth.user.id,
      videoId,
      durationSec,
      framesCount,
      avgConfidence: avgConfidence ?? undefined,
    },
  });

  return NextResponse.json({ ok: true, session });
}

/**
 * GET /api/pose-sessions?athleteId=...&videoId=...
 * Возвращает сессии. Тренер может смотреть свои подопечные (фильтр athleteId),
 * атлет — только свои.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuthUser(request);
  if ('response' in auth) return auth.response;

  const url = new URL(request.url);
  const athleteIdParam = url.searchParams.get('athleteId');
  const videoIdParam = url.searchParams.get('videoId');

  const where: { athleteId?: string; videoId?: string } = {};
  if (auth.user.role === 'COACH') {
    if (athleteIdParam) where.athleteId = athleteIdParam;
  } else {
    where.athleteId = auth.user.id;
  }
  if (videoIdParam) where.videoId = videoIdParam;

  const sessions = await prisma.poseSession.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: {
      video: { select: { id: true, title: true, thumbnail: true } },
      athlete: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  return NextResponse.json({ sessions });
}
