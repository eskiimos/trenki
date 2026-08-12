// Серверная сборка лиги (когорта по году рождения + недельный XP) для
// произвольного userId. Общий хелпер для /api/parent/league (родитель смотрит
// ребёнка) и /api/league (спортсмен смотрит свою лигу) — запросы к БД живут
// здесь ОДИН раз. Приватность: в результате НЕТ userId других детей и НЕТ их
// реальных имён — чужие показываются под сгенерированными правдоподобными
// именами (см. '@/lib/league'); имена когорты из БД вообще не выбираются.
// Чистая логика лиги — в '@/lib/league' (тестируется без БД).

import { prisma } from '@/lib/prisma';
import { Prisma } from '@/generated/prisma';
import { buildStandings, isoWeekLabel, type LeagueEntry, type LeagueStandings } from '@/lib/league';
import { computeWeeklyXp, TEMPO_MIN_STREAK, type DayActivityCount } from '@/lib/gamification';

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
  // Имена когорты НЕ тянем: чужие показываются под сгенерированными
  // правдоподобными именами (решение босса — обезличенные данные).
  const cohortProfiles = await prisma.profile.findMany({
    where: {
      birthDate: { gte: yearStart, lt: nextYearStart },
      user: { role: 'ATHLETE', email: { notIn: demoEmails } },
    },
    select: { userId: true },
    take: COHORT_CAP,
  });
  const cohortIds = cohortProfiles.map((p) => p.userId);
  if (!cohortIds.includes(userId)) {
    // Страховка от капа: сам пользователь всегда в когорте
    cohortIds.push(userId);
  }

  // Недельный XP по всей когорте: тренировки ×100 + модули ×20, с учётом
  // «Темпа ×2» (день серии ≥ 3 — весь XP дня удвоен). Для множителя нужны
  // ПО-ДНЕВНЫЕ счётчики + lookback на (TEMPO_MIN_STREAK - 1) дня ДО старта
  // недели: серия Пт-Сб-Вс должна давать ×2 уже с понедельника. Lookback-дни
  // участвуют только в определении множителя, в сумму XP не входят
  // (см. computeWeeklyXp).
  const weekStart = currentWeekStart();
  const lookbackStart = new Date(
    weekStart.getTime() - (TEMPO_MIN_STREAK - 1) * 24 * 60 * 60 * 1000,
  );
  const [sessionDayCounts, moduleDayCounts] = await Promise.all([
    prisma.$queryRaw<{ userId: string; d: Date; cnt: number }[]>(Prisma.sql`
      SELECT ws."userId", date_trunc('day', ws."completedAt") AS d, COUNT(*)::int AS cnt
      FROM "workout_sessions" ws
      WHERE ws.status = 'COMPLETED'
        AND ws.synthetic = false
        AND ws."completedAt" >= ${lookbackStart}
        AND ws."userId" IN (${Prisma.join(cohortIds)})
      GROUP BY 1, 2
    `),
    // У workout_session_videos нет userId — JOIN к workout_sessions
    prisma.$queryRaw<{ userId: string; d: Date; cnt: number }[]>(Prisma.sql`
      SELECT ws."userId", date_trunc('day', wsv."completedAt") AS d, COUNT(*)::int AS cnt
      FROM "workout_session_videos" wsv
      JOIN "workout_sessions" ws ON ws.id = wsv."sessionId"
      WHERE wsv.completed = true
        AND ws.status = 'COMPLETED'
        AND ws.synthetic = false
        AND wsv."completedAt" >= ${lookbackStart}
        AND ws."userId" IN (${Prisma.join(cohortIds)})
      GROUP BY 1, 2
    `),
  ]);

  const groupByUser = (rows: { userId: string; d: Date; cnt: number }[]) => {
    const by = new Map<string, DayActivityCount[]>();
    for (const r of rows) {
      let list = by.get(r.userId);
      if (!list) {
        list = [];
        by.set(r.userId, list);
      }
      list.push({ day: r.d, count: r.cnt });
    }
    return by;
  };
  const workoutsBy = groupByUser(sessionDayCounts);
  const modulesBy = groupByUser(moduleDayCounts);
  // Нулевые тоже включаются — когорта целиком, ранги честные
  const entries: LeagueEntry[] = cohortIds.map((id) => ({
    userId: id,
    weeklyXp: computeWeeklyXp(workoutsBy.get(id) ?? [], modulesBy.get(id) ?? [], weekStart),
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
