// Награды текущего пользователя. Древо навыков считается на лету из истории
// завершений, а «Стая» — по дате подтверждённого вступления в команду.
// Для каждой цели берём число ЗАВЕРШЁННЫХ WorkoutSession с этой целью
// (groupBy по goal), затем чистый расчёт — computeAchievements
// (tests/lib/achievements.test.ts).

import { NextRequest, NextResponse } from 'next/server';
import { requireAuthUser } from '@/lib/coach/guards';
import { prisma } from '@/lib/prisma';
import { WorkoutStatus, type TrainingGoal } from '@/generated/prisma';
import { computeAchievements, countCycleGoalCredits, cycleCreditQuery } from '@/lib/achievements';
import { computeStreakAchievements } from '@/lib/streak-achievements';
import { fetchCompletionHistory, userTimezone } from '@/lib/gamification-server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await requireAuthUser(request);
  if ('response' in auth) return auth.response;

  const [rows, cycles] = await Promise.all([
    // Число завершённых тренировок по каждой цели (goal не null) — быстрые.
    prisma.workoutSession.groupBy({
      by: ['goal'],
      where: { userId: auth.user.id, status: WorkoutStatus.COMPLETED, goal: { not: null } },
      _count: { _all: true },
    }),
    // Сессии с явной целью уже учтены выше.
    prisma.microcycle.findMany(cycleCreditQuery(auth.user.id)),
  ]);

  const goalCounts: Partial<Record<TrainingGoal, number>> = {};
  for (const row of rows) {
    if (row.goal) goalCounts[row.goal] = row._count._all;
  }

  // Зачёт цикловых: только полные дни (База/Овертайм/Лёгкая), COMPLETED,
  // с реальной работой — правила в countCycleGoalCredits.
  const cycleCounts = countCycleGoalCredits(cycles);
  for (const [goal, count] of Object.entries(cycleCounts)) {
    const g = goal as TrainingGoal;
    goalCounts[g] = (goalCounts[g] ?? 0) + (count ?? 0);
  }

  // Вторая группа наград — «Ачивки» (поведенческие: серии, ранняя пташка,
  // воин выходных, «Стая»). Тренировочные награды считаются в таймзоне игрока.
  const [{ trainingDayAts }, tz] = await Promise.all([
    fetchCompletionHistory(auth.user.id),
    userTimezone(auth.user.id),
  ]);
  const streakAchievements = computeStreakAchievements(
    trainingDayAts,
    tz,
    auth.user.teamPackEarnedAt !== null,
  );

  const achievements = computeAchievements(goalCounts);
  const unlockedCount = achievements.filter((a) => a.unlocked).length;

  return NextResponse.json({
    // «Достижения» — древо навыков (совместимость: поле не переименовано)
    achievements,
    unlockedCount,
    total: achievements.length,
    // «Ачивки» — серии, вехи и вступление в команду
    streakAchievements,
    streakUnlockedCount: streakAchievements.filter((a) => a.unlocked).length,
    streakTotal: streakAchievements.length,
  });
}
