import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAsync } from '@/lib/admin-session';
import { prisma } from '@/lib/prisma';
import { deleteS3ObjectsByUrls, headObjectSize, s3KeyFromUrl } from '@/lib/s3';
import { kickMediaWorker } from '@/lib/media/worker';
import { isRawUploadUrl } from '@/lib/media/url-plan';

export const dynamic = 'force-dynamic';

// POST /api/admin/media-jobs/[id]/retry — повторить упавшую обработку
// (кнопка «Повторить» в админке). Исходник должен всё ещё лежать в бакете.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await requireAdminAsync(request);
  if (denied) return denied;
  const { id } = await params;

  const job = await prisma.mediaJob.findUnique({
    where: { id },
    select: { status: true, sourceUrl: true, targetType: true, targetId: true, publishOnReady: true },
  });
  if (!job) return NextResponse.json({ error: 'Задача не найдена' }, { status: 404 });
  if (job.status !== 'FAILED') {
    return NextResponse.json({ error: 'Повторить можно только упавшую обработку' }, { status: 409 });
  }
  const key = s3KeyFromUrl(job.sourceUrl);
  if (!key || (await headObjectSize(key, AbortSignal.timeout(15_000))) === null) {
    return NextResponse.json({ error: 'Исходный файл уже удалён — загрузите видео заново' }, { status: 410 });
  }

  // У цели с рабочим файлом (упала ЗАМЕНА) публикацию решает текущее состояние
  // карточки, а не намерение на момент заливки.
  const target =
    job.targetType === 'SHORT'
      ? await prisma.short.findUnique({ where: { id: job.targetId }, select: { videoUrl: true, isPublished: true } })
      : await prisma.video.findUnique({ where: { id: job.targetId }, select: { videoUrl: true, isPublished: true } });
  if (!target) {
    // Цель удалили, а упавшая задача осталась — убираем её и исходник.
    const { count } = await prisma.mediaJob.updateMany({
      where: { id, status: 'FAILED' },
      data: { status: 'CANCELED', finishedAt: new Date() },
    });
    if (count === 1) await deleteS3ObjectsByUrls([job.sourceUrl]);
    return NextResponse.json({ error: 'Видео уже удалено' }, { status: 410 });
  }
  const publishOnReady = isRawUploadUrl(target.videoUrl) ? job.publishOnReady : target.isPublished;

  const { count } = await prisma.mediaJob.updateMany({
    where: { id, status: 'FAILED' },
    data: {
      status: 'QUEUED',
      attempts: 0,
      interruptions: 0,
      publishOnReady,
      error: null,
      stage: null,
      progress: 0,
      finishedAt: null,
      heartbeatAt: null,
    },
  });
  if (count !== 1) {
    return NextResponse.json({ error: 'Статус задачи изменился — обновите страницу' }, { status: 409 });
  }
  kickMediaWorker({ immediate: true });
  return NextResponse.json({ ok: true });
}
