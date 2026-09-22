import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuthUser, requireCoach } from '@/lib/coach/guards';
import { isCoachOfAthlete } from '@/lib/coach/athlete-access';
import { canReviewPoseSession, canViewPoseSession } from '@/lib/pose-access';
import { POSE_FRAMES_ENCODING } from '@/lib/pose-storage';

export const dynamic = 'force-dynamic';

/**
 * GET /api/pose-sessions/[id]
 * Атлет видит только свою сессию, тренер — сессии атлетов своих команд (ACTIVE).
 *
 * Кадры скелета НЕ возвращаются в ответе:
 *  - новые сессии: возвращаем `framesUrl` — наш же адрес /api/pose-sessions/[id]/frames,
 *    который отдаёт gzip из закрытого S3 после той же проверки доступа;
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

  // Раньше любой COACH открывал любую сессию. Проверку команды делаем только
  // тренеру и только для чужой сессии — свою атлет открывает без запроса в БД.
  const coachOfAthlete =
    auth.user.role === 'COACH' &&
    session.athleteId !== auth.user.id &&
    (await isCoachOfAthlete(auth.user.id, session.athleteId));
  if (!canViewPoseSession(auth.user, session.athleteId, coachOfAthlete)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Не возвращаем сырую `frames` JSON-колонку наружу: она тяжёлая и используется
  // только как legacy-фолбэк. Вместо неё — ссылка на наш /frames.
  let framesUrl: string | null = null;
  let framesEncoding: string | null = null;
  let legacyFrames: number[][] | null = null;

  if (session.framesUrl) {
    framesUrl = `/api/pose-sessions/${session.id}/frames`;
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
 * Тренер ставит оценку и комментарий к сессии трекинга движений атлета
 * своей команды (ACTIVE). Раньше оценить можно было любую сессию в базе.
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

  const existing = await prisma.poseSession.findUnique({
    where: { id },
    select: { athleteId: true },
  });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const coachOfAthlete =
    existing.athleteId !== auth.user.id &&
    (await isCoachOfAthlete(auth.user.id, existing.athleteId));
  if (!canReviewPoseSession(auth.user, existing.athleteId, coachOfAthlete)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Отдаём только поля оценки: полная строка тащила бы legacy-кадры (JSONB до
  // 9000 кадров) и сырой Cloudinary public_id, а клиенту нужен лишь факт успеха.
  const updated = await prisma.poseSession.update({
    where: { id },
    data: {
      coachId: auth.user.id,
      coachRating: rating,
      coachComment: comment ?? undefined,
      reviewedAt: new Date(),
    },
    select: {
      id: true,
      athleteId: true,
      videoId: true,
      coachId: true,
      coachRating: true,
      coachComment: true,
      reviewedAt: true,
    },
  });

  return NextResponse.json({ ok: true, session: updated });
}
