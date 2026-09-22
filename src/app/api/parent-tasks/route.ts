import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuthUser } from '@/lib/coach/guards';
import { recentParentTasksWhere, withProgress } from '@/lib/parent-tasks-server';

export const dynamic = 'force-dynamic';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * GET /api/parent-tasks — задания от родителей ТЕКУЩЕГО пользователя-ребёнка
 * (экран «Мои задания»): активные и выполненные за последние 30 дней, с прогрессом.
 * Отменённые родителем не показываем.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuthUser(request);
  if ('response' in auth) return auth.response;
  const tasks = await prisma.parentTask.findMany({
    where: recentParentTasksWhere(auth.user.id, new Date(Date.now() - 30 * DAY_MS)),
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  return NextResponse.json({ tasks: await withProgress(tasks) });
}
