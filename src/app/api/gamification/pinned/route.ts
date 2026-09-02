import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuthUser } from '@/lib/coach/guards';
import { computeAchievements, countCycleGoalCredits } from '@/lib/achievements';
import { computeStreakAchievements } from '@/lib/streak-achievements';
import { fetchCompletionHistory, userTimezone } from '@/lib/gamification-server';
import { WorkoutStatus, type TrainingGoal } from '@/generated/prisma';

/**
 * PUT /api/gamification/pinned { key: string | null }
 *
 * Закрепить награду под фотографией в профиле (правка владельца). Хранится
 * только ключ — сама награда выводится из истории, как XP.
 *
 * Закрепить можно ТОЛЬКО полученную награду: иначе в витрине профиля висела бы
 * ачивка, которой у человека нет. Проверяем по тем же расчётам, что отдаёт
 * /api/gamification/achievements (обе группы).
 */
export const dynamic = 'force-dynamic';

export async function PUT(request: NextRequest) {
  const auth = await requireAuthUser(request);
  if ('response' in auth) return auth.response;

  const body = await request.json().catch(() => ({}));
  const raw = body?.key;
  const key = typeof raw === 'string' && raw.trim() ? raw.trim() : null;

  // Снять закрепление — всегда можно
  if (key === null) {
    await prisma.user.update({ where: { id: auth.user.id }, data: { pinnedAchievement: null } });
    return NextResponse.json({ pinnedAchievement: null });
  }

  // Собираем ПОЛУЧЕННЫЕ награды обеих групп
  const [{ trainingDayAts }, tz, rows, cycles] = await Promise.all([
    fetchCompletionHistory(auth.user.id),
    userTimezone(auth.user.id),
    prisma.workoutSession.groupBy({
      by: ['goal'],
      where: { userId: auth.user.id, status: WorkoutStatus.COMPLETED, goal: { not: null } },
      _count: { _all: true },
    }),
    prisma.microcycle.findMany({
      where: { userId: auth.user.id },
      select: {
        cycleNumber: true,
        days: {
          select: {
            dayOfWeek: true,
            intent: true,
            workoutSession: {
              select: { status: true, goal: true, videos: { select: { completed: true } } },
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

  const unlocked = new Set(
    [
      ...computeStreakAchievements(trainingDayAts, tz),
      ...computeAchievements(goalCounts),
    ]
      .filter((a) => a.unlocked)
      .map((a) => a.key),
  );

  if (!unlocked.has(key)) {
    return NextResponse.json(
      { error: 'Эту награду ещё не получил — закрепить нельзя' },
      { status: 400 },
    );
  }

  await prisma.user.update({ where: { id: auth.user.id }, data: { pinnedAchievement: key } });
  return NextResponse.json({ pinnedAchievement: key });
}
