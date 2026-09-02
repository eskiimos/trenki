// Ачивки текущего пользователя («Древо навыков»): считаются на лету из истории
// завершений (в БД ничего не хранится — ретроактивная модель, как XP/уровни).
// Для каждой цели берём число ЗАВЕРШЁННЫХ WorkoutSession с этой целью
// (groupBy по goal), затем чистый расчёт — computeAchievements
// (tests/lib/achievements.test.ts).

import { NextRequest, NextResponse } from 'next/server';
import { requireAuthUser } from '@/lib/coach/guards';
import { prisma } from '@/lib/prisma';
import { WorkoutStatus, type TrainingGoal } from '@/generated/prisma';
import { computeAchievements, countCycleGoalCredits } from '@/lib/achievements';
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
    // Цикловые дни: goal у их сессий пуст, цель восстанавливается из
    // intent+cycleNumber (правка владельца «трени из цикла не дают ачивки»).
    prisma.microcycle.findMany({
      where: { userId: auth.user.id },
      select: {
        cycleNumber: true,
        days: {
          select: {
            dayOfWeek: true,
            intent: true,
            workoutSession: {
              select: {
                status: true,
                goal: true,
                videos: { select: { completed: true } },
              },
            },
          },
        },
      },
    }),
  ]);

  const goalCounts: Partial<Record<TrainingGoal, number>> = {};
  for (const row of rows) {
    if (row.goal) goalCounts[row.goal] = row._count._all;
  }

  // Зачёт цикловых: только полные дни (База/Овертайм/Лёгкая), COMPLETED,
  // с реальной работой — правила в countCycleGoalCredits.
  const cycleCounts = countCycleGoalCredits(
    cycles.map((c) => ({
      cycleNumber: c.cycleNumber,
      days: c.days.map((d) => ({
        dayOfWeek: d.dayOfWeek,
        intent: d.intent,
        session: d.workoutSession
          ? {
              status: d.workoutSession.status,
              goal: d.workoutSession.goal,
              hasWork: d.workoutSession.videos.some((v) => v.completed),
              allDone:
                d.workoutSession.videos.length > 0 &&
                d.workoutSession.videos.every((v) => v.completed),
            }
          : null,
      })),
    })),
  );
  for (const [goal, count] of Object.entries(cycleCounts)) {
    const g = goal as TrainingGoal;
    goalCounts[g] = (goalCounts[g] ?? 0) + (count ?? 0);
  }

  // Вторая группа наград — «Ачивки» (поведенческие: серии, ранняя пташка,
  // воин выходных). Правка владельца: развести награды на две категории.
  // Считаются из той же истории завершений и в таймзоне игрока — раньше
  // «до 08:00» означало 08:00 серверного времени.
  const [{ trainingDayAts }, tz] = await Promise.all([
    fetchCompletionHistory(auth.user.id),
    userTimezone(auth.user.id),
  ]);
  const streakAchievements = computeStreakAchievements(trainingDayAts, tz);

  const achievements = computeAchievements(goalCounts);
  const unlockedCount = achievements.filter((a) => a.unlocked).length;

  return NextResponse.json({
    // «Достижения» — древо навыков (совместимость: поле не переименовано)
    achievements,
    unlockedCount,
    total: achievements.length,
    // «Ачивки» — серии и вехи
    streakAchievements,
    streakUnlockedCount: streakAchievements.filter((a) => a.unlocked).length,
    streakTotal: streakAchievements.length,
  });
}
