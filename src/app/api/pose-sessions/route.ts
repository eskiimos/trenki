import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuthUser } from '@/lib/coach/guards';
import { coachAthletesWhere, isCoachOfAthlete } from '@/lib/coach/athlete-access';
import { resolvePoseListScope } from '@/lib/pose-access';
import type { Prisma } from '@/generated/prisma';
import {
  POSE_FRAMES_ENCODING,
  encodePoseFrames,
  isPoseStorageConfigured,
  savePoseFrames,
} from '@/lib/pose-storage';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const MAX_FRAMES = 9000; // до 5 минут записи на 30 fps
const MAX_LANDMARK_NUMS = 200; // ~33 ландмарка × 6 значений с запасом

/**
 * POST /api/pose-sessions
 * Атлет сохраняет результат сессии трекинга движений.
 * Body: { videoId, durationSec, framesCount, avgConfidence?, fps?, frames? }
 *
 * `frames` (если есть) пакуются в gzip-JSON и заливаются в Cloudinary;
 * в БД пишется только URL, не сами кадры.
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
  const fps =
    body.fps === undefined || body.fps === null
      ? null
      : Math.max(1, Math.min(30, Math.floor(Number(body.fps))));

  // Валидируем и квантуем кадры (отрезаем мусор, ограничиваем по длине).
  let frames: number[][] | null = null;
  if (Array.isArray(body.frames)) {
    const arr = body.frames.slice(0, MAX_FRAMES) as unknown[];
    frames = arr
      .filter(
        (f): f is number[] => Array.isArray(f) && f.length > 0 && f.length <= MAX_LANDMARK_NUMS,
      )
      .map((f) => f.map((n) => Math.round(Number(n) || 0)));
    if (frames.length === 0) frames = null;
  }

  if (!videoId) return NextResponse.json({ error: 'videoId is required' }, { status: 400 });

  const video = await prisma.video.findUnique({ where: { id: videoId } });
  if (!video) return NextResponse.json({ error: 'Video not found' }, { status: 404 });

  // Сначала создаём запись без кадров, чтобы получить cuid для ключа в S3.
  const session = await prisma.poseSession.create({
    data: {
      athleteId: auth.user.id,
      videoId,
      durationSec,
      framesCount,
      avgConfidence: avgConfidence ?? undefined,
      fps: fps ?? undefined,
    },
  });

  // Затем — кладём кадры в наш S3 (закрытый объект pose/sessions/<id>.json.gz).
  if (frames && frames.length > 0) {
    if (!isPoseStorageConfigured()) {
      // Dev-фолбэк: храним в БД JSONB, как раньше. Это не должно случаться в проде.
      logger.warn('pose-frames: S3 не настроен, пишем в БД JSONB');
      await prisma.poseSession.update({
        where: { id: session.id },
        data: { frames },
      });
    } else {
      try {
        const payload = encodePoseFrames({ fps, frames });
        const framesUrl = await savePoseFrames('sessions', session.id, payload);
        await prisma.poseSession.update({
          where: { id: session.id },
          data: {
            framesUrl,
            framesEncoding: POSE_FRAMES_ENCODING,
          },
        });
        logger.info('pose-frames uploaded', {
          sessionId: session.id,
          frames: frames.length,
          bytes: payload.length,
        });
      } catch (err) {
        logger.error('pose-frames upload failed', err, { sessionId: session.id });
        // Сессия остаётся без кадров — это лучше, чем 500.
      }
    }
  }

  return NextResponse.json({ ok: true, session: { id: session.id } });
}

/**
 * GET /api/pose-sessions?athleteId=...&videoId=...
 * Тренер видит сессии атлетов своих команд (ACTIVE), атлет — только свои.
 * Сами кадры не возвращаем (тяжело) — только превью-метаданные.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuthUser(request);
  if ('response' in auth) return auth.response;

  const url = new URL(request.url);
  const athleteIdParam = url.searchParams.get('athleteId');
  const videoIdParam = url.searchParams.get('videoId');

  const where: Prisma.PoseSessionWhereInput = {};
  const scope = resolvePoseListScope(auth.user, athleteIdParam);
  if (scope.kind === 'own') {
    where.athleteId = auth.user.id;
  } else if (scope.kind === 'coach-athlete') {
    // Чужой атлет — 403, как у карточки атлета (coach-view): страница атлета
    // тренеру в этом случае и так недоступна, молча отдавать пустой список незачем.
    if (!(await isCoachOfAthlete(auth.user.id, scope.athleteId))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    where.athleteId = scope.athleteId;
  } else {
    // Без ?athleteId раньше уходил пустой where — последние 50 сессий всей базы.
    where.athlete = coachAthletesWhere(auth.user.id);
  }
  if (videoIdParam) where.videoId = videoIdParam;

  const sessions = await prisma.poseSession.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 50,
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
