import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuthUser, requireCoach } from '@/lib/coach/guards';
import { POSE_FRAMES_ENCODING, signPoseFramesUrl } from '@/lib/pose-storage';

export const dynamic = 'force-dynamic';

/**
 * GET /api/pose-sessions/[id]
 * Тренер видит любую сессию, атлет — только свою.
 *
 * Кадры скелета НЕ возвращаются в ответе:
 *  - новые сессии: возвращаем `framesUrl` (signed, TTL 1 час) — клиент сам качает с Cloudinary;
 *  - старые сессии (до миграции): возвращаем `frames` напрямую из БД.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuthUser(request);
  if ('response' in auth) return auth.response;

  const { id } = await context.params;
  const session = await prisma.poseSession.findUnique({
    where: { id },
    include: {
      video: { select: { id: true, title: true, thumbnail: true } },
      athlete: { select: { id: true, firstName: true, lastName: true } },
    },
  });
  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (auth.user.role !== 'COACH' && session.athleteId !== auth.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Не возвращаем сырую `frames` JSON-колонку наружу: она тяжёлая и используется
  // только как legacy-фолбэк. Вместо неё — signed URL.
  let framesUrl: string | null = null;
  let framesEncoding: string | null = null;
  let legacyFrames: number[][] | null = null;

  if (session.framesUrl) {
    framesUrl = signPoseFramesUrl(session.framesUrl);
    framesEncoding = session.framesEncoding ?? POSE_FRAMES_ENCODING;
  } else if (session.frames) {
    // Старая сессия: до бэкфилла отдаём кадры напрямую, чтобы плеер тренера
    // продолжал работать. После бэкфилла этой ветки не будет.
    legacyFrames = session.frames as unknown as number[][];
  }

  return NextResponse.json({
    session: {
      id: session.id,
      athleteId: session.athleteId,
      videoId: session.videoId,
      durationSec: session.durationSec,
      framesCount: session.framesCount,
      avgConfidence: session.avgConfidence,
      fps: session.fps,
      coachId: session.coachId,
      coachRating: session.coachRating,
      coachComment: session.coachComment,
      reviewedAt: session.reviewedAt,
      createdAt: session.createdAt,
      video: session.video,
      athlete: session.athlete,
      framesUrl,
      framesEncoding,
      frames: legacyFrames,
    },
  });
}

/**
 * PATCH /api/pose-sessions/[id]
 * Тренер ставит оценку и комментарий к сессии трекинга движений атлета.
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireCoach(request);
  if ('response' in auth) return auth.response;

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

  const rating = Number(body.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ error: 'rating must be integer 1..5' }, { status: 400 });
  }
  const comment = typeof body.comment === 'string' ? body.comment.slice(0, 1000) : null;

  const existing = await prisma.poseSession.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const updated = await prisma.poseSession.update({
    where: { id },
    data: {
      coachId: auth.user.id,
      coachRating: rating,
      coachComment: comment ?? undefined,
      reviewedAt: new Date(),
    },
  });

  return NextResponse.json({ ok: true, session: updated });
}
