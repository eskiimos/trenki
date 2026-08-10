// «Древо навыков» — цель-ориентированные ачивки. Считаются РЕТРОАКТИВНО из
// уже существующей истории: для каждой из 7 целей тренировок берём число
// ЗАВЕРШЁННЫХ WorkoutSession с этой целью (любая завершённая сессия, где goal
// задан: быстрая ИИ-тренировка, дни микроцикла, тренер). В БД ничего не
// хранится, миграций нет — как и XP, ачивки детерминированно выводятся из
// истории и появляются у всех сразу.
//
// Механика на цель: 5 завершённых → Эволюция 1, 10 → Эволюция 2.
// Чистая логика — тестируется без БД (tests/lib/achievements.test.ts).

import type { TrainingGoal } from '@/generated/prisma';

/** Пороги эволюций (число завершённых тренировок с данной целью). */
export const EVO1_TARGET = 5;
export const EVO2_TARGET = 10;

/** Одна ветка дерева: цель + две её эволюции. */
export interface SkillGoalDef {
  goal: TrainingGoal;
  /** Русское название цели (из комментария enum TrainingGoal). */
  goalTitle: string;
  /** Стабильный slug для ключей ачивок: `<slug>_evo1` / `<slug>_evo2`. */
  slug: string;
  evo1: { key: string; title: string };
  evo2: { key: string; title: string };
}

/**
 * Дерево навыков — 7 веток, порядок фиксирован (совпадает с UI и total).
 * goalTitle — русские названия из enum TrainingGoal в schema.prisma.
 */
export const SKILL_TREE: SkillGoalDef[] = [
  {
    goal: 'OUTRUN_OPPONENT',
    goalTitle: 'Убегаем от соперника',
    slug: 'outrun',
    evo1: { key: 'outrun_evo1', title: 'Ракета на льду' },
    evo2: { key: 'outrun_evo2', title: 'Молния' },
  },
  {
    goal: 'POWERFUL_SHOT',
    goalTitle: 'Мощный бросок',
    slug: 'shot',
    evo1: { key: 'shot_evo1', title: 'Насквозь' },
    evo2: { key: 'shot_evo2', title: 'Пушка страшная' },
  },
  {
    goal: 'STRENGTH_STABILITY',
    goalTitle: 'Силовая борьба и устойчивость',
    slug: 'strength',
    evo1: { key: 'strength_evo1', title: 'Питбуль' },
    evo2: { key: 'strength_evo2', title: 'Викинг' },
  },
  {
    goal: 'SOFT_HANDS',
    goalTitle: 'Мягкие ручки',
    slug: 'hands',
    evo1: { key: 'hands_evo1', title: 'Финтёр' },
    evo2: { key: 'hands_evo2', title: 'Фокусник' },
  },
  {
    goal: 'FULL_GAME_ENDURANCE',
    goalTitle: 'Выносливость на всю игру',
    slug: 'endurance',
    evo1: { key: 'endurance_evo1', title: 'Неутомимый' },
    evo2: { key: 'endurance_evo2', title: 'Марафонец' },
  },
  {
    goal: 'AGILITY',
    goalTitle: 'Маневренность',
    slug: 'agility',
    evo1: { key: 'agility_evo1', title: 'Гепард' },
    evo2: { key: 'agility_evo2', title: 'Вихрь' },
  },
  {
    goal: 'SPORT_LONGEVITY',
    goalTitle: 'Спортивное долголетие',
    slug: 'longevity',
    evo1: { key: 'longevity_evo1', title: 'Под защитой' },
    evo2: { key: 'longevity_evo2', title: 'Терминатор' },
  },
];

export interface AchievementDef {
  key: string;
  title: string;
  /** Условие получения по-русски — показывается под закрытой ачивкой. */
  description: string;
  /** Цель тренировки, по которой считается прогресс. */
  goal: TrainingGoal;
  /** 1 — Эволюция 1 (порог 5), 2 — Эволюция 2 (порог 10). */
  tier: 1 | 2;
  target: number;
  /** Простой emoji для back-compat формы API / fallback (UI рендерит иконку). */
  emoji: string;
}

export interface AchievementState extends AchievementDef {
  unlocked: boolean;
  /** current всегда обрезан по target (для мини-прогрессбара в UI). */
  progress: { current: number; target: number };
}

/** Emoji на ключ — свободный «весёлый» набор для fallback/дайджестов. */
const EMOJI: Record<string, string> = {
  outrun_evo1: '🚀', outrun_evo2: '⚡',
  shot_evo1: '🎯', shot_evo2: '💣',
  strength_evo1: '🐶', strength_evo2: '🪓',
  hands_evo1: '🪄', hands_evo2: '🎭',
  endurance_evo1: '💓', endurance_evo2: '👟',
  agility_evo1: '🐆', agility_evo2: '🌪️',
  longevity_evo1: '🛡️', longevity_evo2: '🤖',
};

/**
 * Полный плоский набор из 14 определений (evo1, затем evo2 — по каждой цели
 * в порядке SKILL_TREE). Стабильный порядок используют total в API и UI.
 */
export const ACHIEVEMENT_DEFS: AchievementDef[] = SKILL_TREE.flatMap((branch) => [
  {
    key: branch.evo1.key,
    title: branch.evo1.title,
    description: `${EVO1_TARGET} тренировок «${branch.goalTitle}»`,
    goal: branch.goal,
    tier: 1 as const,
    target: EVO1_TARGET,
    emoji: EMOJI[branch.evo1.key] ?? '🏒',
  },
  {
    key: branch.evo2.key,
    title: branch.evo2.title,
    description: `${EVO2_TARGET} тренировок «${branch.goalTitle}»`,
    goal: branch.goal,
    tier: 2 as const,
    target: EVO2_TARGET,
    emoji: EMOJI[branch.evo2.key] ?? '🏒',
  },
]);

/**
 * Расчёт состояния всех 14 ачивок из числа завершённых тренировок по каждой
 * цели. goalCounts — Partial-мапа goal → count; неизвестные/лишние ключи в
 * ней просто игнорируются (перебираем ACHIEVEMENT_DEFS, а не входные ключи).
 * Порядок результата совпадает с ACHIEVEMENT_DEFS.
 */
export function computeAchievements(
  goalCounts: Partial<Record<TrainingGoal, number>>,
): AchievementState[] {
  return ACHIEVEMENT_DEFS.map((def) => {
    const count = Math.max(0, Math.floor(goalCounts[def.goal] ?? 0));
    return {
      ...def,
      unlocked: count >= def.target,
      progress: { current: Math.min(count, def.target), target: def.target },
    };
  });
}
