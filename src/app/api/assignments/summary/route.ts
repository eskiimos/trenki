import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuthUser } from '@/lib/coach/guards';
import { activeDueCutoff } from '@/lib/assignments/active';
import { countTaskProgress } from '@/lib/parent-tasks-server';
import { relationWords, taskProgressLabel } from '@/lib/parent-tasks';

export const dynamic = 'force-dynamic';

/**
 * GET /api/assignments/summary — сколько у атлета активных заданий (для одной
 * ситуативной кнопки на главной: «Мои задания» или «ИИ-тренер», п.10
 * «Середина сентября»). Правило «активного» — src/lib/assignments/active.ts:
 * невыполненное, просрочка не больше 3 дней. Задания от тренера и от родителя.
 * single — подпись, если активное задание ровно одно и оно от родителя
 * («Мама дала задание» · «Мощный бросок · 1/3»).
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuthUser(request);
  if ('response' in auth) return auth.response;
  const cutoff = activeDueCutoff(new Date());

  const [fromCoach, parentTasks] = await Promise.all([
    prisma.trainingAssignment.count({
      where: { athleteId: auth.user.id, status: { not: 'COMPLETED' }, dueDate: { gte: cutoff } },
    }),
    prisma.parentTask.findMany({
      where: { childId: auth.user.id, status: 'ACTIVE', dueDate: { gte: cutoff } },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
  ]);
  const fromParent = parentTasks.length;

  let single: { caption: string; title: string } | null = null;
  if (fromCoach === 0 && fromParent === 1) {
    const task = parentTasks[0];
    single = {
      caption: relationWords(task.relation).gave,
      title: taskProgressLabel(task.goal, await countTaskProgress(task), task.target),
    };
  }

  return NextResponse.json({ active: fromCoach + fromParent, fromCoach, fromParent, single });
}
