// Сводка геймификации текущего пользователя: XP, уровень, статус-«эволюция»,
// стрик. Всё считается на лету из истории тренировок (XP в БД не хранится —
// см. src/lib/gamification.ts), поэтому роут только читает.

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuthUser } from '@/lib/coach/guards';
import { computeXp, levelFromXp, statusFromLevel, computeStreak } from '@/lib/gamification';
import { WorkoutStatus } from '@/generated/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await requireAuthUser(request);
  if ('response' in auth) return auth.response;
  const userId = auth.user.id;

  // Счётчики для XP + даты завершений для стрика — параллельно.
  // Для стрика хватает последних ~120 завершений: больше 120 дней подряд
  // физически означает 120+ тренировок в этой выборке.
  const [completedWorkouts, completedModules, recentCompleted] = await Promise.all([
    prisma.workoutSession.count({
      where: { userId, status: WorkoutStatus.COMPLETED },
    }),
    prisma.workoutSessionVideo.count({
      where: { completed: true, session: { userId } },
    }),
    prisma.workoutSession.findMany({
      where: { userId, status: WorkoutStatus.COMPLETED, completedAt: { not: null } },
      orderBy: { completedAt: 'desc' },
      select: { completedAt: true },
      take: 120,
    }),
  ]);

  const xp = computeXp({ completedWorkouts, completedModules });
  const levelInfo = levelFromXp(xp);
  const status = statusFromLevel(levelInfo.level);
  const streak = computeStreak(
    recentCompleted.map((s) => s.completedAt!),
  );

  return NextResponse.json({
    xp: levelInfo.xpTotal,
    level: levelInfo.level,
    xpIntoLevel: levelInfo.xpIntoLevel,
    xpForNext: levelInfo.xpForNext,
    status: { key: status.key, title: status.title, emoji: status.emoji },
    nextStatus: status.nextStatus
      ? { title: status.nextStatus.title, minLevel: status.nextStatus.minLevel }
      : null,
    streak,
  });
}
