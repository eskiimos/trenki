import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAsync } from '@/lib/admin-session';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { enqueueMissingPoseJobs, enqueuePoseJob, cancelPoseJob, POSE_JOB_SELECT, PoseQueueError } from '@/lib/pose/jobs';
import { POSE_LEASE_MS } from '@/lib/pose/queue-policy';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const denied = await requireAdminAsync(request);
  if (denied) return denied;
  try {
    const videoId = request.nextUrl.searchParams.get('videoId');
    const jobs = await prisma.poseReferenceJob.findMany({
      ...(videoId ? { where: { videoId } } : {}),
      select: { ...POSE_JOB_SELECT, video: { select: { title: true } } },
      orderBy: { updatedAt: 'desc' }, take: 100,
    });
    const counts = await prisma.poseReferenceJob.groupBy({ by: ['status'], _count: true });
    const worker = await prisma.poseWorkerState.findUnique({ where: { id: 'default' } });
    return NextResponse.json({ jobs, counts: Object.fromEntries(counts.map((c) => [c.status, c._count])),
      workerOnline: !!worker && Date.now() - worker.heartbeatAt.getTime() < POSE_LEASE_MS });
  } catch (error) {
    logger.error('pose jobs GET failed', error);
    return NextResponse.json({ error: 'Не удалось загрузить очередь' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const denied = await requireAdminAsync(request);
  if (denied) return denied;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object' || Array.isArray(body)) return NextResponse.json({ error: 'Некорректный запрос' }, { status: 400 });
  const { action, videoId, replace } = body;
  if (!['missing', 'enqueue', 'cancel'].includes(action)
    || (action !== 'missing' && (typeof videoId !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(videoId)))
    || (replace !== undefined && typeof replace !== 'boolean')) {
    return NextResponse.json({ error: 'Некорректная операция очереди' }, { status: 400 });
  }
  try {
    if (action === 'missing') return NextResponse.json(await enqueueMissingPoseJobs(), { status: 202 });
    if (action === 'cancel') { await cancelPoseJob(videoId); return NextResponse.json({ status: 'canceled' }); }
    return NextResponse.json({ status: await enqueuePoseJob(videoId, replace === true) }, { status: 202 });
  } catch (error) {
    if (error instanceof PoseQueueError) return NextResponse.json({ error: error.message }, { status: error.status });
    logger.error('pose jobs POST failed', error);
    return NextResponse.json({ error: 'Не удалось изменить очередь' }, { status: 500 });
  }
}
