// «Что считать тренировкой» — одно определение на весь проект.
//
// До этого каждое место решало само, и цифры расходились: график админки брал
// только COMPLETED (досрочный финиш PARTIAL и тренировки со скипом модуля
// выпадали), зато считал синтетику админ-накрутки, чит-сессии тестеров и
// «закрытые дни цикла» (день цикла становится COMPLETED без единого модуля,
// когда его заменяет быстрая тренировка — одна реальная тренировка шла за две).
// Лига и история при этом считали иначе.
//
// Здесь только чистая часть: политика, предикат для уже загруженных строк и
// сборка Prisma-where (тип-импорт, клиента не тянет — тестируется без БД).
// Запрос к БД — в ./workout-definition-server.

import type { Prisma } from '@/generated/prisma';

/** Финальные статусы, которые вообще могут считаться тренировкой. */
export type CountedWorkoutStatus = 'COMPLETED' | 'PARTIAL';

export interface WorkoutCountPolicy {
  /** COMPLETED — полная; PARTIAL — досрочный финиш или финиш со скипами. */
  statuses: readonly CountedWorkoutStatus[];
  /** Сессии synthetic=true — засеяны админом (накрутка стрика/уровня). */
  includeSynthetic: boolean;
  /**
   * Исключать аккаунты команды (isAdmin / isTester). Имеет смысл только для
   * агрегатов по всем пользователям: у админов/тестеров чит-режим создаёт
   * COMPLETED-сессию на каждый свободный просмотр видео.
   */
  excludeStaff: boolean;
  /**
   * Требовать ≥1 реально пройденный модуль. Отсекает «закрытый день цикла»
   * (close-day / замена быстрой тренировкой): такой день COMPLETED при нуле
   * модулей, а сама работа уже посчитана в быстрой тренировке.
   */
  requireCompletedModule: boolean;
}

/**
 * Решение владельца (21.09, п.6): графики и KPI админки. Завершённые и
 * досрочно завершённые, без синтетики, без админов/тестеров, без дублей
 * закрытого дня цикла.
 * НЕ равно подсчётам лиги (league-server): там бонус ×100 — только COMPLETED
 * с ≥1 пройденным модулем (PARTIAL не в счёт), а день темпа — COMPLETED+PARTIAL
 * без проверки модулей; команду лига отсекает по role=ATHLETE (и демо-email),
 * а не по isAdmin/isTester. Общее с лигой — только synthetic = false.
 * Для лиговых цифр этот пресет не брать.
 */
export const ADMIN_STATS_WORKOUTS: WorkoutCountPolicy = {
  statuses: ['COMPLETED', 'PARTIAL'],
  includeSynthetic: false,
  excludeStaff: true,
  requireCompletedModule: true,
};

/**
 * Реальная тренировка конкретного пользователя (дайджест родителю и т.п.):
 * то же определение, но без фильтра команды — пользователь известен заранее.
 */
export const REAL_WORKOUTS: WorkoutCountPolicy = {
  ...ADMIN_STATS_WORKOUTS,
  excludeStaff: false,
};

/**
 * День серии (стрик, «Темп ×2»): ровно как trainingDayAts в
 * fetchCompletionHistory (gamification-server). Синтетика и закрытые дни
 * цикла здесь СЧИТАЮТСЯ — иначе серия в пуше разойдётся с серией на главной.
 */
export const STREAK_DAY_WORKOUTS: WorkoutCountPolicy = {
  statuses: ['COMPLETED', 'PARTIAL'],
  includeSynthetic: true,
  excludeStaff: false,
  requireCompletedModule: false,
};

/** Факты о сессии, достаточные для решения «считать или нет». */
export interface WorkoutFacts {
  status: string;
  completedAt: Date | null;
  synthetic: boolean;
  /** Сколько модулей сессии реально пройдено (completed = true). */
  completedModules: number;
  /** Владелец сессии — админ или тестер. */
  ownerIsStaff: boolean;
}

/** Предикат для уже загруженных строк; зеркало countedWorkoutWhere. */
export function isCountedWorkout(s: WorkoutFacts, policy: WorkoutCountPolicy): boolean {
  if (!(policy.statuses as readonly string[]).includes(s.status)) return false;
  // Без даты завершения тренировку не положить ни в один день
  if (!s.completedAt) return false;
  if (!policy.includeSynthetic && s.synthetic) return false;
  if (policy.excludeStaff && s.ownerIsStaff) return false;
  if (policy.requireCompletedModule && s.completedModules < 1) return false;
  return true;
}

/**
 * Prisma-where по политике. У WorkoutSession нет relation на User (userId —
 * голое поле), поэтому команду исключаем списком id: при excludeStaff его
 * обязательно передать (getStaffUserIds в серверной части) — иначе бросаем,
 * чтобы команда не попала в цифры молча.
 */
export function countedWorkoutWhere(
  policy: WorkoutCountPolicy,
  opts: { staffUserIds?: readonly string[] } = {},
): Prisma.WorkoutSessionWhereInput {
  const where: Prisma.WorkoutSessionWhereInput = {
    status: { in: [...policy.statuses] },
    completedAt: { not: null },
  };
  if (!policy.includeSynthetic) where.synthetic = false;
  if (policy.requireCompletedModule) where.videos = { some: { completed: true } };
  if (policy.excludeStaff) {
    if (!opts.staffUserIds) {
      throw new Error('countedWorkoutWhere: excludeStaff требует staffUserIds');
    }
    if (opts.staffUserIds.length > 0) where.userId = { notIn: [...opts.staffUserIds] };
  }
  return where;
}

/** Аккаунты команды: у них чит-режим и тестовые регистрации. */
export const STAFF_USER_WHERE = {
  OR: [{ isAdmin: true }, { isTester: true }],
} satisfies Prisma.UserWhereInput;

/** Все, кроме команды, — для регистраций в аналитике. */
export const NON_STAFF_USER_WHERE = {
  isAdmin: false,
  isTester: false,
} satisfies Prisma.UserWhereInput;
