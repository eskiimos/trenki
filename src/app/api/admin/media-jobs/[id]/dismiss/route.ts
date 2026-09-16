import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAsync } from '@/lib/admin-session';
import { prisma } from '@/lib/prisma';
import { deleteS3ObjectsByUrls } from '@/lib/s3';
import { isRawUploadUrl } from '@/lib/media/url-plan';

export const dynamic = 'force-dynamic';

// POST /api/admin/media-jobs/[id]/dismiss — «Оставить текущий файл»: убрать
// упавшую ЗАМЕНУ файла у видео/шортса, у которого уже есть рабочий файл.
// Исходник замены удаляется. Для новой карточки без рабочего файла — 409:
// там нужен новый файл, а не отмена.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await requireAdminAsync(request);
  if (denied) return denied;
  const { id } = await params;

  const job = await prisma.mediaJob.findUnique({
    where: { id },
    select: { status: true, sourceUrl: true, targetType: true, targetId: true },
  });
  if (!job) return NextResponse.json({ error: 'Задача не найдена' }, { status: 404 });
  if (job.status !== 'FAILED') {
    return NextResponse.json({ error: 'Отменить можно только упавшую обработку' }, { status: 409 });
  }
  const target =
    job.targetType === 'SHORT'
      ? await prisma.short.findUnique({ where: { id: job.targetId }, select: { videoUrl: true } })
      : await prisma.video.findUnique({ where: { id: job.targetId }, select: { videoUrl: true } });
  if (target && (isRawUploadUrl(target.videoUrl) || target.videoUrl === job.sourceUrl)) {
    return NextResponse.json({ error: 'У карточки нет рабочего файла — загрузите видео заново' }, { status: 409 });
  }

  const { count } = await prisma.mediaJob.updateMany({
    where: { id, status: 'FAILED' },
    data: { status: 'CANCELED', finishedAt: new Date() },
  });
  if (count === 1) await deleteS3ObjectsByUrls([job.sourceUrl]);
  return NextResponse.json({ ok: true });
}
