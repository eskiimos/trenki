import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuthUser } from '@/lib/coach/guards';
import { activeDueCutoff } from '@/lib/assignments/active';

export const dynamic = 'force-dynamic';

/**
 * GET /api/assignments/summary — сколько у атлета активных заданий (для одной
 * ситуативной кнопки на главной: «Мои задания» или «ИИ-тренер», п.10
 * «Середина сентября»). Правило «активного» — src/lib/assignments/active.ts.
 * Сейчас задания только от тренера; задания от родителя добавятся сюда же,
 * главная менять ничего не будет.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuthUser(request);
  if ('response' in auth) return auth.response;

  const fromCoach = await prisma.trainingAssignment.count({
    where: {
      athleteId: auth.user.id,
      status: { not: 'COMPLETED' },
      dueDate: { gte: activeDueCutoff(new Date()) },
    },
  });
  return NextResponse.json({ active: fromCoach, fromCoach });
}
