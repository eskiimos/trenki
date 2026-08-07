// Лига (геймификация, Фаза 3): недельная таблица когорты по году рождения
// для родительского кабинета. Приватность: в ответе НЕТ userId других детей —
// только ряды из buildStandings (чужие под стабильными никами, свой — по имени).
// Чистая логика лиги — в '@/lib/league' (тестируется без БД).

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma, WorkoutStatus } from '@/generated/prisma';
import { requireAuthUser } from '@/lib/coach/guards';
import { buildStandings, isoWeekLabel } from '@/lib/league';
import {
  XP_PER_COMPLETED_WORKOUT,
  XP_PER_COMPLETED_MODULE,
} from '@/lib/gamification';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/** Кап когорты: защита от гигантских выборок, для лиги хватает 300 сверстников. */
const COHORT_CAP = 300;

/** Понедельник 00:00 локального серверного времени — старт текущей ISO-недели. */
function currentWeekStart(now: Date = new Date()): Date {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7)); // Пн=0 ... Вс=6
  return start;
}

export async function GET(request: NextRequest) {
  const auth = await requireAuthUser(request);
  if ('response' in auth) return auth.response;
  const parentId = auth.user.id;

  const childId = request.nextUrl.searchParams.get('childId');
  if (!childId) {
    return NextResponse.json({ error: 'childId обязателен' }, { status: 400 });
  }

  try {
    // Родитель видит лигу только своего ребёнка (ParentLink обязателен)
    const link = await prisma.parentLink.findUnique({
      where: { parentId_childId: { parentId, childId } },
      select: { id: true },
    });
    if (!link) {
      return NextResponse.json({ error: 'Нет доступа к этому ребёнку' }, { status: 403 });
    }

    const child = await prisma.user.findUnique({
      where: { id: childId },
      select: { firstName: true, profile: { select: { birthDate: true } } },
    });
    const birthDate = child?.profile?.birthDate ?? null;
    if (!birthDate) {
      // UI попросит заполнить дату рождения в профиле ребёнка
      return NextResponse.json({ noBirthYear: true });
    }

    // Когорта: все профили с датой рождения в том же календарном году.
    // birthDate хранится как timestamp — год берём в UTC и диапазон строим в UTC,
    // чтобы сам ребёнок гарантированно попадал в собственную когорту.
    const year = birthDate.getUTCFullYear();
    const yearStart = new Date(Date.UTC(year, 0, 1));
    const nextYearStart = new Date(Date.UTC(year + 1, 0, 1));
    const cohortProfiles = await prisma.profile.findMany({
      where: { birthDate: { gte: yearStart, lt: nextYearStart } },
      select: { userId: true },
      take: COHORT_CAP,
    });
    const cohortIds = cohortProfiles.map((p) => p.userId);
    if (!cohortIds.includes(childId)) cohortIds.push(childId); // страховка от капа

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
    const entries = cohortIds.map((userId) => ({
      userId,
      weeklyXp:
        (workoutsBy.get(userId) ?? 0) * XP_PER_COMPLETED_WORKOUT +
        (modulesBy.get(userId) ?? 0) * XP_PER_COMPLETED_MODULE,
    }));

    const weekLabel = isoWeekLabel();
    const standings = buildStandings(
      entries,
      childId,
      child?.firstName || 'Твой хоккеист',
      `${weekLabel}-${year}`,
    );

    return NextResponse.json({ league: standings, weekLabel, year });
  } catch (error) {
    logger.error('parent league fetch failed', error);
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 });
  }
}
