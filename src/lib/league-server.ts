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

/**
 * Лига живёт в ЕДИНОЙ таймзоне — Москве: неделя и граница дня общие для всей
 * когорты, иначе соревнование нечестное (у каждого своя полночь). Раньше неделя
 * стартовала в полночь ТАЙМЗОНЫ СЕРВЕРА (в проде UTC → понедельник начинался в
 * 03:00 МСК, и воскресные вечерние тренировки уезжали в новую неделю).
 * МСК = UTC+3 без переходов на летнее время (отменены в 2014) — константа
 * безопасна; SQL режет дни тем же 'Europe/Moscow'.
 */
const MSK_OFFSET_MS = 3 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Старт текущей лиговой недели: МОМЕНТ (UTC-instant) московского понедельника 00:00. */
function currentWeekStartInstant(now: Date = new Date()): Date {
  // now в московской шкале → полночь текущего дня → назад до понедельника
  const msk = new Date(now.getTime() + MSK_OFFSET_MS);
  const mskMidnight = Date.UTC(msk.getUTCFullYear(), msk.getUTCMonth(), msk.getUTCDate());
  const monday = mskMidnight - ((new Date(mskMidnight).getUTCDay() + 6) % 7) * DAY_MS;
  return new Date(monday - MSK_OFFSET_MS);
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
  //
  // Формула сведена с профильным XP (рассинхрон «в профиле растёт, в лиге нет»):
  //  · PARTIAL-сессии дают свои модули и день темпа (но не бонус ×100);
  //  · бонус ×100 — только за COMPLETED с ≥1 реально пройденным модулем:
  //    день цикла, закрытый подстановкой (close-day), становится COMPLETED при
  //    нуле видео — второй +100 за тот же реальный день не начисляем.
  // Осознанное расхождение: synthetic-накрутка видна в профиле (демо), но в
  // честную лигу не попадает.
  //
  // Дни режем по Москве и в SQL, и в JS. В SQL обязательна ДВОЙНАЯ форма
  // (ts AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Moscow': колонка naive-UTC,
  // и одинарный AT TIME ZONE её НЕ конвертирует, а интерпретирует как
  // московскую (классическая ловушка Postgres) — день уезжал бы на сутки.
  // Двойная форма даёт naive московское «стеночное» время, детерминированно
  // (не зависит от TimeZone сессии БД); Prisma парсит его как UTC — поэтому
  // в computeWeeklyXp передаём tz='UTC', чтобы взять календарный день без
  // второго сдвига.
  const weekStartInstant = currentWeekStartInstant();
  // Московская дата понедельника, закодированная как UTC-полночь — в одной
  // системе координат с d из SQL.
  const weekStartDay = new Date(weekStartInstant.getTime() + MSK_OFFSET_MS);
  const lookbackStart = new Date(
    weekStartInstant.getTime() - (TEMPO_MIN_STREAK - 1) * DAY_MS,
  );
  const [sessionDayCounts, moduleDayCounts] = await Promise.all([
    prisma.$queryRaw<{ userId: string; d: Date; completedCnt: number; trainingCnt: number }[]>(Prisma.sql`
      SELECT ws."userId",
             date_trunc('day', (ws."completedAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Moscow') AS d,
             COUNT(*) FILTER (
               WHERE ws.status = 'COMPLETED'
                 AND EXISTS (
                   SELECT 1 FROM "workout_session_videos" v
                   WHERE v."sessionId" = ws.id AND v.completed = true
                 )
             )::int AS "completedCnt",
             COUNT(*)::int AS "trainingCnt"
      FROM "workout_sessions" ws
      WHERE ws.status IN ('COMPLETED', 'PARTIAL')
        AND ws.synthetic = false
        AND ws."completedAt" >= ${lookbackStart}
        AND ws."userId" IN (${Prisma.join(cohortIds)})
      GROUP BY 1, 2
    `),
    // У workout_session_videos нет userId — JOIN к workout_sessions
    prisma.$queryRaw<{ userId: string; d: Date; cnt: number }[]>(Prisma.sql`
      SELECT ws."userId",
             date_trunc('day', (wsv."completedAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Moscow') AS d,
             COUNT(*)::int AS cnt
      FROM "workout_session_videos" wsv
      JOIN "workout_sessions" ws ON ws.id = wsv."sessionId"
      WHERE wsv.completed = true
        AND ws.status IN ('COMPLETED', 'PARTIAL')
        AND ws.synthetic = false
        AND wsv."completedAt" >= ${lookbackStart}
        AND ws."userId" IN (${Prisma.join(cohortIds)})
      GROUP BY 1, 2
    `),
  ]);

  const workoutsBy = new Map<string, DayActivityCount[]>();
  const trainingDaysBy = new Map<string, DayActivityCount[]>();
  for (const r of sessionDayCounts) {
    if (!workoutsBy.has(r.userId)) workoutsBy.set(r.userId, []);
    if (!trainingDaysBy.has(r.userId)) trainingDaysBy.set(r.userId, []);
    workoutsBy.get(r.userId)!.push({ day: r.d, count: r.completedCnt });
    trainingDaysBy.get(r.userId)!.push({ day: r.d, count: r.trainingCnt });
  }
  const modulesBy = new Map<string, DayActivityCount[]>();
  for (const r of moduleDayCounts) {
    if (!modulesBy.has(r.userId)) modulesBy.set(r.userId, []);
    modulesBy.get(r.userId)!.push({ day: r.d, count: r.cnt });
  }
  // Нулевые тоже включаются — когорта целиком, ранги честные
  const entries: LeagueEntry[] = cohortIds.map((id) => ({
    userId: id,
    weeklyXp: computeWeeklyXp(
      workoutsBy.get(id) ?? [],
      modulesBy.get(id) ?? [],
      weekStartDay,
      trainingDaysBy.get(id) ?? [],
      'UTC',
    ),
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
