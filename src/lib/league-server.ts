// Серверная сборка лиги (когорта по году рождения + недельный XP) для
// произвольного userId. Общий хелпер для /api/parent/league (родитель смотрит
// ребёнка) и /api/league (спортсмен смотрит свою лигу) — запросы к БД живут
// здесь ОДИН раз. Приватность: в результате НЕТ userId других детей и НЕТ
// полных фамилий — чужие показываются как «Имя Ф.» (см. '@/lib/league').
// Чистая логика лиги — в '@/lib/league' (тестируется без БД).

import { prisma } from '@/lib/prisma';
import { Prisma, WorkoutStatus } from '@/generated/prisma';
import { buildStandings, isoWeekLabel, type LeagueEntry, type LeagueStandings } from '@/lib/league';
import {
  XP_PER_COMPLETED_WORKOUT,
  XP_PER_COMPLETED_MODULE,
} from '@/lib/gamification';

/** Кап когорты: защита от гигантских выборок, для лиги хватает 300 сверстников. */
const COHORT_CAP = 300;

/** Понедельник 00:00 локального серверного времени — старт текущей ISO-недели. */
function currentWeekStart(now: Date = new Date()): Date {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7)); // Пн=0 ... Вс=6
  return start;
}

export type LeagueForUser =
  | { noBirthYear: true }
  | { league: LeagueStandings | null; weekLabel: string; year: number };

export async function buildLeagueForUser(userId: string): Promise<LeagueForUser> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      firstName: true,
      lastName: true,
      profile: { select: { birthDate: true } },
    },
  });
  const birthDate = user?.profile?.birthDate ?? null;
  if (!birthDate) {
    // UI попросит заполнить дату рождения в профиле
    return { noBirthYear: true };
  }

  // Когорта: все профили с датой рождения в том же календарном году.
  // birthDate хранится как timestamp — год берём в UTC и диапазон строим в UTC,
  // чтобы сам пользователь гарантированно попадал в собственную когорту.
  const year = birthDate.getUTCFullYear();
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const nextYearStart = new Date(Date.UTC(year + 1, 0, 1));
  // Только СПОРТСМЕНЫ: без фильтра роли в когорту просачивались аккаунты
  // родителей/тренеров с заполненным профилем (баг, пойманный владельцем).
  // Демо-аккаунты (email из DEMO_BYPASS_EMAIL + посеянный демо-атлет) тоже
  // исключаем — витрина не должна светиться в реальных лигах.
  const demoEmails = (process.env.DEMO_BYPASS_EMAIL || '')
    .split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
  demoEmails.push('demo.athlete@trenki.app');
  const cohortProfiles = await prisma.profile.findMany({
    where: {
      birthDate: { gte: yearStart, lt: nextYearStart },
      user: { role: 'ATHLETE', email: { notIn: demoEmails } },
    },
    select: {
      userId: true,
      user: { select: { firstName: true, lastName: true } },
    },
    take: COHORT_CAP,
  });
  const namesBy = new Map(
    cohortProfiles.map((p) => [p.userId, { firstName: p.user.firstName, lastName: p.user.lastName }]),
  );
  const cohortIds = cohortProfiles.map((p) => p.userId);
  if (!cohortIds.includes(userId)) {
    // Страховка от капа: сам пользователь всегда в когорте
    cohortIds.push(userId);
    namesBy.set(userId, { firstName: user?.firstName ?? null, lastName: user?.lastName ?? null });
  }

  // Недельный XP по всей когорте: тренировки ×100 + модули ×20
  const weekStart = currentWeekStart();
  const [sessionCounts, moduleCounts] = await Promise.all([
    prisma.workoutSession.groupBy({
      by: ['userId'],
      where: {
        userId: { in: cohortIds },
        status: WorkoutStatus.COMPLETED,
        completedAt: { gte: weekStart },
      },
      _count: { _all: true },
    }),
    // У workout_session_videos нет userId — JOIN к workout_sessions
    prisma.$queryRaw<{ userId: string; cnt: number }[]>(Prisma.sql`
      SELECT ws."userId", COUNT(*)::int AS cnt
      FROM "workout_session_videos" wsv
      JOIN "workout_sessions" ws ON ws.id = wsv."sessionId"
      WHERE wsv.completed = true
        AND ws.status = 'COMPLETED'
        AND wsv."completedAt" >= ${weekStart}
        AND ws."userId" IN (${Prisma.join(cohortIds)})
      GROUP BY ws."userId"
    `),
  ]);

  const workoutsBy = new Map(sessionCounts.map((s) => [s.userId, s._count._all]));
  const modulesBy = new Map(moduleCounts.map((m) => [m.userId, m.cnt]));
  // Нулевые тоже включаются — когорта целиком, ранги честные
  const entries: LeagueEntry[] = cohortIds.map((id) => ({
    userId: id,
    weeklyXp:
      (workoutsBy.get(id) ?? 0) * XP_PER_COMPLETED_WORKOUT +
      (modulesBy.get(id) ?? 0) * XP_PER_COMPLETED_MODULE,
    firstName: namesBy.get(id)?.firstName ?? null,
    lastName: namesBy.get(id)?.lastName ?? null,
  }));

  const weekLabel = isoWeekLabel();
  const standings = buildStandings(
    entries,
    userId,
    user?.firstName || 'Твой хоккеист',
    `${weekLabel}-${year}`,
  );

  return { league: standings, weekLabel, year };
}
