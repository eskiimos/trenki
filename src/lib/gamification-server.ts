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
): Promise<{ workoutAts: Date[]; moduleAts: Date[]; trainingDayAts: Date[] }> {
  const [trainingSessions, moduleVideos] = await Promise.all([
    prisma.workoutSession.findMany({
      // COMPLETED — полные тренировки (бонус +100). PARTIAL — досрочный финиш:
      // даёт день серии/темпа, но без бонуса. Брошенные/PENDING не считаются.
      where: {
        userId,
        status: { in: [WorkoutStatus.COMPLETED, WorkoutStatus.PARTIAL] },
        completedAt: { not: null },
      },
      // hasWork: есть ли в сессии хоть один реально пройденный модуль. День
      // цикла, закрытый подстановкой быстрой тренировки (close-day), получает
      // COMPLETED при нуле пройденных видео — бонус +100 за него был бы вторым
      // за тот же реальный день (первый даёт сама быстрая). Такие сессии дают
      // день серии/темпа, но НЕ дают бонус.
      select: {
        completedAt: true,
        status: true,
        videos: { where: { completed: true }, take: 1, select: { id: true } },
      },
    }),
    prisma.workoutSessionVideo.findMany({
      // Модули ЗАСЧИТАННЫХ тренировок: полностью завершённых (COMPLETED) и
      // досрочно финишированных (PARTIAL — пройденные модули засчитываются).
      // Модули брошенных/PENDING сессий в XP не идут (античит-ревью перед лигой —
      // иначе фарм модулей без завершения обходил дневные лимиты).
      where: {
        completed: true,
        session: { userId, status: { in: [WorkoutStatus.COMPLETED, WorkoutStatus.PARTIAL] } },
      },
      select: { completedAt: true },
    }),
  ]);

  return {
    // Бонус +100 — только за полные тренировки С реальной работой (см. hasWork).
    workoutAts: trainingSessions
      .filter((s) => s.status === WorkoutStatus.COMPLETED && s.videos.length > 0)
      .map((s) => s.completedAt!),
    // Legacy-модули без completedAt не теряют свои 20 XP: эпоха гарантированно
    // вне любой серии → множитель ×1, как и раньше.
    moduleAts: moduleVideos.map((m) => m.completedAt ?? new Date(0)),
    // Все тренировочные дни (полные + досрочные) — для серии и «Темпа ×2».
    trainingDayAts: trainingSessions.map((s) => s.completedAt!),
  };
}

/** Таймзона пользователя для границы календарного дня (стрик/темп/XP).
 *  Аудитория — РФ, поэтому фолбэк при NULL/битой tz — Москва. */
export async function userTimezone(userId: string): Promise<string> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { timezone: true },
  });
  return u?.timezone || 'Europe/Moscow';
}

export async function getGamificationSummary(userId: string): Promise<GamificationSummary> {
  // Для «Темпа ×2» XP считается ретроактивно из ПОЛНОЙ истории дат завершений
  // (XP в БД не хранится — инвариант).
  const [{ workoutAts, moduleAts, trainingDayAts }, tz] = await Promise.all([
    fetchCompletionHistory(userId),
    userTimezone(userId),
  ]);

  const { xpTotal, tempoActiveToday } = computeXpFromHistory(
    workoutAts,
    moduleAts,
    new Date(),
    trainingDayAts,
    tz,
  );
  const levelInfo = levelFromXp(xpTotal);
  const status = statusFromLevel(levelInfo.level);
  // Серия — по всем тренировочным дням (полным и досрочным), в таймзоне юзера.
  const streak = computeStreak(trainingDayAts, new Date(), tz);

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
      where: {
        completed: true,
        completedAt: { gte: weekAgo },
        session: { userId, status: { in: [WorkoutStatus.COMPLETED, WorkoutStatus.PARTIAL] } },
      },
    }),
  ]);
  return { workouts, modules };
}
