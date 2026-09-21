// Серверная часть определения «тренировки»: запросы к БД поверх чистой
// политики из ./workout-definition. Чистую часть тестируем отдельно.

import { prisma } from '@/lib/prisma';
import type { Prisma } from '@/generated/prisma';
import {
  countedWorkoutWhere,
  STAFF_USER_WHERE,
  type WorkoutCountPolicy,
} from '@/lib/stats/workout-definition';

/** id админов и тестеров — их единицы, выборка дешёвая. */
export async function getStaffUserIds(): Promise<string[]> {
  const rows = await prisma.user.findMany({ where: STAFF_USER_WHERE, select: { id: true } });
  return rows.map((r) => r.id);
}

/**
 * Готовый where по политике. Список команды достаёт сам, если он нужен и не
 * передан: когда в одном запросе несколько подсчётов (график + итог за всё
 * время), его берут один раз через getStaffUserIds и передают во все.
 */
export async function resolveCountedWorkoutWhere(
  policy: WorkoutCountPolicy,
  staffUserIds?: readonly string[],
): Promise<Prisma.WorkoutSessionWhereInput> {
  const staff = policy.excludeStaff ? staffUserIds ?? (await getStaffUserIds()) : undefined;
  return countedWorkoutWhere(policy, { staffUserIds: staff });
}

interface CountedWorkoutQuery {
  /** Нижняя граница completedAt (включительно); без неё — за всё время. */
  since?: Date;
  /** Верхняя граница completedAt (не включительно). */
  until?: Date;
  userId?: string;
  /** Заранее полученный список команды (см. resolveCountedWorkoutWhere). */
  staffUserIds?: readonly string[];
}

async function buildWhere(
  policy: WorkoutCountPolicy,
  q: CountedWorkoutQuery,
): Promise<Prisma.WorkoutSessionWhereInput> {
  const base = await resolveCountedWorkoutWhere(policy, q.staffUserIds);
  const range =
    q.since || q.until
      ? [{ completedAt: { ...(q.since ? { gte: q.since } : {}), ...(q.until ? { lt: q.until } : {}) } }]
      : [];
  return { AND: [base, ...range, ...(q.userId ? [{ userId: q.userId }] : [])] };
}

/**
 * Моменты завершения засчитанных тренировок в полуинтервале [since, until).
 * Отдаём голые даты — раскладку по дням делает buildDailySeries (по нужной
 * таймзоне: Москва для админки, таймзона пользователя для его экранов).
 */
export async function findCountedWorkoutDates(
  policy: WorkoutCountPolicy,
  opts: CountedWorkoutQuery & { since: Date },
): Promise<Date[]> {
  const rows = await prisma.workoutSession.findMany({
    where: await buildWhere(policy, opts),
    select: { completedAt: true },
  });
  // completedAt not null гарантирован политикой; фильтр — для типов
  return rows.flatMap((r) => (r.completedAt ? [r.completedAt] : []));
}

/** Число засчитанных тренировок (без since — за всё время). */
export async function countCountedWorkouts(
  policy: WorkoutCountPolicy,
  opts: CountedWorkoutQuery = {},
): Promise<number> {
  return prisma.workoutSession.count({ where: await buildWhere(policy, opts) });
}
