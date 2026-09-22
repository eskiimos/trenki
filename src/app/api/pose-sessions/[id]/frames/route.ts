import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuthUser } from '@/lib/coach/guards';
import { isCoachOfAthlete } from '@/lib/coach/athlete-access';
import { canViewPoseSession } from '@/lib/pose-access';
import { loadPoseFrames } from '@/lib/pose-storage';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/pose-sessions/[id]/frames — кадры скелета (gzip JSON) из закрытого
 * S3. Доступ — как у GET /api/pose-sessions/[id]: сам атлет или тренер его
 * ACTIVE-команды. Клиент распаковывает сам (DecompressionStream).
 */
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAuthUser(request);
  if ('response' in auth) return auth.response;

  const { id } = await context.params;
  const session = await prisma.poseSession.findUnique({
    where: { id },
    select: { athleteId: true, framesUrl: true },
  });
  if (!session || !session.framesUrl) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const coachOfAthlete =
    auth.user.role === 'COACH' &&
    session.athleteId !== auth.user.id &&
    (await isCoachOfAthlete(auth.user.id, session.athleteId));
  if (!canViewPoseSession(auth.user, session.athleteId, coachOfAthlete)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const buf = await loadPoseFrames(session.framesUrl);
    return new Response(new Uint8Array(buf), {
      headers: { 'Content-Type': 'application/gzip', 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    logger.error('pose session frames load failed', error, { sessionId: id });
    return NextResponse.json({ error: 'Не удалось загрузить кадры' }, { status: 502 });
  }
}
