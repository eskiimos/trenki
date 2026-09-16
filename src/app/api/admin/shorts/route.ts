import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAsync } from '@/lib/admin-session';
import { prisma } from '@/lib/prisma';
import { isRawUploadUrl } from '@/lib/media/url-plan';

export const dynamic = 'force-dynamic';

// GET /api/admin/shorts — ВСЕ шортсы для админки, включая неопубликованные.
// Раньше админка брала публичный /api/shorts (только isPublished): черновики и
// шортсы на обработке в списке не показывались, открыть их было нельзя.
// publishIntent — что админ выбрал для шортса на обработке (в БД он временно
// isPublished=false); форма показывает именно его, даже если статусы задач
// ещё не подгрузились.
export async function GET(request: NextRequest) {
  const denied = await requireAdminAsync(request);
  if (denied) return denied;
  const shorts = await prisma.short.findMany({
    orderBy: [{ isPinned: 'desc' }, { order: 'asc' }, { createdAt: 'desc' }],
  });
  const rawIds = shorts.filter((s) => isRawUploadUrl(s.videoUrl)).map((s) => s.id);
  const jobs = rawIds.length
    ? await prisma.mediaJob.findMany({
        where: { targetType: 'SHORT', targetId: { in: rawIds }, status: { in: ['QUEUED', 'PROCESSING', 'FAILED'] } },
        orderBy: { createdAt: 'desc' },
        select: { targetId: true, publishOnReady: true },
      })
    : [];
  const intent = new Map<string, boolean>();
  for (const job of jobs) if (!intent.has(job.targetId)) intent.set(job.targetId, job.publishOnReady);
  return NextResponse.json({
    shorts: shorts.map((s) => ({ ...s, publishIntent: intent.has(s.id) ? intent.get(s.id) : null })),
  });
}
