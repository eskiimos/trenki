// Серверный сбор сводки геймификации для произвольного userId. Общий хелпер
// для /api/gamification/summary (сам атлет) и /api/parent/children (родитель
// смотрит прогресс ребёнка) — запросы к БД живут здесь ОДИН раз.
// Чистая математика (XP/уровни/стрик) — в '@/lib/gamification'.

import { prisma } from '@/lib/prisma';
import {
  computeXpFromHistory,
  levelFromXp,
  statusFromLevel,
  computeStreak,
  TEMPO_MULTIPLIER,
} from '@/lib/gamification';
import { WorkoutStatus } from '@/generated/prisma';

export interface GamificationSummary {
  xp: number;
  level: number;
  xpIntoLevel: number;
  xpForNext: number;
  status: { key: string; title: string; emoji: string };
  nextStatus: { title: string; minLevel: number } | null;
  streak: number;
  /** «Темп ×2» активен прямо сейчас (серия ≥ 3 дней жива). */
  tempoActive: boolean;
  /** Текущий множитель XP дня: 2 при активном темпе, иначе 1. */
  tempoMultiplier: number;
}

/**
 * Полная история дат завершений пользователя — общая выборка для XP/уровней
 * (getGamificationSummary) и ачивок (/api/gamification/achievements).
 * Тянем только completedAt — это дёшево: даже годы ежедневных тренировок —
 * тысячи строк по одному timestamp.
 */
export async function fetchCompletionHistory(
  userId: string,
): Promise<{ workoutAts: Date[]; moduleAts: Date[] }> {
  const [workoutSessions, moduleVideos] = await Promise.all([
    prisma.workoutSession.findMany({
      where: { userId, status: WorkoutStatus.COMPLETED, completedAt: { not: null } },
      select: { completedAt: true },
    }),
    prisma.workoutSessionVideo.findMany({
      // Только модули ДОВЕДЁННЫХ до конца тренировок: модули брошенных/PENDING
      // сессий в XP не идут (античит-ревью перед лигой — иначе фарм модулей
      // без завершения обходил дневные лимиты).
      where: { completed: true, session: { userId, status: 'COMPLETED' } },
      select: { completedAt: true },
    }),
  ]);

  return {
    workoutAts: workoutSessions.map((s) => s.completedAt!),
    // Legacy-модули без completedAt не теряют свои 20 XP: эпоха гарантированно
    // вне любой серии → множитель ×1, как и раньше.
    moduleAts: moduleVideos.map((m) => m.completedAt ?? new Date(0)),
  };
}

export async function getGamificationSummary(userId: string): Promise<GamificationSummary> {
  // Для «Темпа ×2» XP считается ретроактивно из ПОЛНОЙ истории дат завершений
  // (XP в БД не хранится — инвариант).
  const { workoutAts, moduleAts } = await fetchCompletionHistory(userId);

  const { xpTotal, tempoActiveToday } = computeXpFromHistory(workoutAts, moduleAts);
  const levelInfo = levelFromXp(xpTotal);
  const status = statusFromLevel(levelInfo.level);
  const streak = computeStreak(workoutAts);

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
    tempoActive: tempoActiveToday,
    tempoMultiplier: tempoActiveToday ? TEMPO_MULTIPLIER : 1,
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
