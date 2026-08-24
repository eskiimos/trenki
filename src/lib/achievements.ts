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
import { goalsFromStoredDays } from '@/lib/microcycle/week-plan';

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

// ─── Зачёт ЦИКЛОВЫХ дней в ачивки ────────────────────────────────────────────
// Цикловые WorkoutSession создаются БЕЗ goal (generate.ts), поэтому groupBy по
// goal их не видел — «трени из цикла не дают + в ачивки» (правка владельца).
// Цель дня восстанавливается детерминированно из intent + cycleNumber той же
// ротацией, что при генерации (goalsFromStoredDays).

/** Полные дни, дающие ачивку (решение владельца): База (IN_TONE),
 *  Овертайм (CHARGED), Лёгкая (TIRED). Зарядка (WARMUP) и Раскисление
 *  (STRETCH) — НЕ дают. */
const CREDIT_INTENTS = new Set(['IN_TONE', 'CHARGED', 'TIRED']);

export interface CycleForAchievements {
  cycleNumber: number;
  days: Array<{
    dayOfWeek: number;
    intent: string;
    session: {
      status: string;
      goal: TrainingGoal | null;
      /** ≥1 реально пройденного видео (отсекает дни, закрытые подстановкой). */
      hasWork: boolean;
      /** ВСЕ видео пройдены (скипы → сессия PARTIAL и сюда не попадает). */
      allDone: boolean;
    } | null;
  }>;
}

/**
 * Число зачтённых цикловых дней по каждой цели. Правила зачёта дня:
 *  · intent ∈ {IN_TONE, CHARGED, TIRED};
 *  · сессия COMPLETED (PARTIAL — консистентно с быстрыми — не считается);
 *  · hasWork и allDone — античит от фантомов close-day (день закрыт заменой:
 *    COMPLETED при нуле пройденных видео) — прирост дала сама замена, и она же
 *    даёт свой goal в ачивки;
 *  · session.goal == null — страховка от двойного счёта, если goal когда-нибудь
 *    начнут писать в цикловые (тогда их посчитает groupBy).
 * ВАЖНО: дни цикла передаются ЦЕЛИКОМ (ротация целей зависит от структуры всей
 * недели) — фильтр по intent применяется здесь, а не до вызова.
 */
export function countCycleGoalCredits(
  cycles: CycleForAchievements[],
): Partial<Record<TrainingGoal, number>> {
  const counts: Partial<Record<TrainingGoal, number>> = {};
  for (const cycle of cycles) {
    const plans = goalsFromStoredDays(
      cycle.days.map((d) => ({
        dayOfWeek: d.dayOfWeek,
        intent: d.intent as Parameters<typeof goalsFromStoredDays>[0][number]['intent'],
      })),
      cycle.cycleNumber,
    );
    const goalByDay = new Map(plans.map((p) => [p.dayOfWeek, p.goal]));
    for (const day of cycle.days) {
      if (!CREDIT_INTENTS.has(day.intent)) continue;
      const s = day.session;
      if (!s || s.status !== 'COMPLETED' || s.goal !== null || !s.hasWork || !s.allDone) continue;
      const goal = goalByDay.get(day.dayOfWeek);
      if (!goal) continue;
      counts[goal] = (counts[goal] ?? 0) + 1;
    }
  }
  return counts;
}
