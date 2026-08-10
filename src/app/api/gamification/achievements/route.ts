// Ачивки текущего пользователя («Древо навыков»): считаются на лету из истории
// завершений (в БД ничего не хранится — ретроактивная модель, как XP/уровни).
// Для каждой цели берём число ЗАВЕРШЁННЫХ WorkoutSession с этой целью
// (groupBy по goal), затем чистый расчёт — computeAchievements
// (tests/lib/achievements.test.ts).

import { NextRequest, NextResponse } from 'next/server';
import { requireAuthUser } from '@/lib/coach/guards';
import { prisma } from '@/lib/prisma';
import { WorkoutStatus, type TrainingGoal } from '@/generated/prisma';
import { computeAchievements } from '@/lib/achievements';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await requireAuthUser(request);
  if ('response' in auth) return auth.response;

  // Число завершённых тренировок по каждой цели (goal не null).
  const rows = await prisma.workoutSession.groupBy({
    by: ['goal'],
    where: { userId: auth.user.id, status: WorkoutStatus.COMPLETED, goal: { not: null } },
    _count: { _all: true },
  });

  const goalCounts: Partial<Record<TrainingGoal, number>> = {};
  for (const row of rows) {
    if (row.goal) goalCounts[row.goal] = row._count._all;
  }

  const achievements = computeAchievements(goalCounts);
  const unlockedCount = achievements.filter((a) => a.unlocked).length;

  return NextResponse.json({ achievements, unlockedCount, total: achievements.length });
}
