// Серверный сбор сводки геймификации для произвольного userId. Общий хелпер
// для /api/gamification/summary (сам атлет) и /api/parent/children (родитель
// смотрит прогресс ребёнка) — запросы к БД живут здесь ОДИН раз.
// Чистая математика (XP/уровни/стрик) — в '@/lib/gamification'.

import { prisma } from '@/lib/prisma';
import { computeXp, levelFromXp, statusFromLevel, computeStreak } from '@/lib/gamification';
import { WorkoutStatus } from '@/generated/prisma';

export interface GamificationSummary {
  xp: number;
  level: number;
  xpIntoLevel: number;
  xpForNext: number;
  status: { key: string; title: string; emoji: string };
  nextStatus: { title: string; minLevel: number } | null;
  streak: number;
}

export async function getGamificationSummary(userId: string): Promise<GamificationSummary> {
  // Счётчики для XP + даты завершений для стрика — параллельно.
  // Для стрика хватает последних ~120 завершений: больше 120 дней подряд
  // физически означает 120+ тренировок в этой выборке.
  const [completedWorkouts, completedModules, recentCompleted] = await Promise.all([
    prisma.workoutSession.count({
      where: { userId, status: WorkoutStatus.COMPLETED },
    }),
    prisma.workoutSessionVideo.count({
      // Только модули ДОВЕДЁННЫХ до конца тренировок: модули брошенных/PENDING
      // сессий в XP не идут (античит-ревью перед лигой — иначе фарм модулей
      // без завершения обходил дневные лимиты).
      where: { completed: true, session: { userId, status: 'COMPLETED' } },
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
  const streak = computeStreak(recentCompleted.map((s) => s.completedAt!));

  return {
    xp: levelInfo.xpTotal,
    level: levelInfo.level,
    xpIntoLevel: levelInfo.xpIntoLevel,
    xpForNext: levelInfo.xpForNext,
    status: { key: status.key, title: status.title, emoji: status.emoji },
    nextStatus: status.nextStatus
      ? { title: status.nextStatus.title, minLevel: status.nextStatus.minLevel }
      : null,
    streak,
  };
}

/** Активность за последние 7 дней: завершённые тренировки и модули. */
export async function getWeekActivity(
  userId: string,
): Promise<{ workouts: number; modules: number }> {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [workouts, modules] = await Promise.all([
    prisma.workoutSession.count({
      where: { userId, status: WorkoutStatus.COMPLETED, completedAt: { gte: weekAgo } },
    }),
    prisma.workoutSessionVideo.count({
      where: { completed: true, completedAt: { gte: weekAgo }, session: { userId, status: 'COMPLETED' } },
    }),
  ]);
  return { workouts, modules };
}
