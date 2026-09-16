import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAsync } from '@/lib/admin-session';
import { latestJobsByTarget } from '@/lib/media/jobs';
import { kickMediaWorker } from '@/lib/media/worker';

export const dynamic = 'force-dynamic';

// GET /api/admin/media-jobs?targetType=VIDEO|SHORT — статусы обработки видео
// для бейджей в админке: { jobs: { [targetId]: { status, stage, progress, error } } }.
// Админка поллит роут, пока что-то обрабатывается, — заодно будим воркер
// (подстраховка к cron, если процесс перезапустился).
export async function GET(request: NextRequest) {
  const denied = await requireAdminAsync(request);
  if (denied) return denied;
  const targetType = new URL(request.url).searchParams.get('targetType');
  if (targetType !== 'VIDEO' && targetType !== 'SHORT') {
    return NextResponse.json({ error: 'targetType: VIDEO или SHORT' }, { status: 400 });
  }
  kickMediaWorker();
  const jobs = await latestJobsByTarget(targetType);
  return NextResponse.json({ jobs });
}
