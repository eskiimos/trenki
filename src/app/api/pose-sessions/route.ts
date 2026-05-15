import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuthUser } from '@/lib/coach/guards';

export const dynamic = 'force-dynamic';

/**
 * POST /api/pose-sessions
 * Атлет сохраняет результат сессии трекинга движений.
 * Body: { videoId, durationSec, framesCount, avgConfidence?, fps?, frames? }
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

  // Сжатые кадры скелета для воспроизведения тренеру. Ограничиваем сверху.
  const fps =
    body.fps === undefined || body.fps === null ? null : Math.max(1, Math.min(30, Math.floor(Number(body.fps))));
  let frames: number[][] | null = null;
  if (Array.isArray(body.frames)) {
    // До 5 минут записи при 30fps = 9000 кадров максимум
    const arr = body.frames.slice(0, 9000) as unknown[];
    frames = arr
      .filter((f): f is number[] => Array.isArray(f) && f.length > 0 && f.length <= 200)
      .map((f) => f.map((n) => Math.round(Number(n) || 0)));
  }

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
      fps: fps ?? undefined,
      frames: frames ?? undefined,
    },
  });

  return NextResponse.json({ ok: true, session: { id: session.id } });
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
    // В списке frames не нужны — экономим трафик
    select: {
      id: true,
      athleteId: true,
      videoId: true,
      durationSec: true,
      framesCount: true,
      avgConfidence: true,
      fps: true,
      coachId: true,
      coachRating: true,
      coachComment: true,
      reviewedAt: true,
      createdAt: true,
      video: { select: { id: true, title: true, thumbnail: true } },
      athlete: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  return NextResponse.json({ sessions });
}
