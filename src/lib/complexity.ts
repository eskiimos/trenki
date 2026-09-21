/**
 * Уровень подготовки видео (enum Complexity) — подписи и правила сопоставления
 * с уровнем атлета. Чистая логика без БД: её используют подбор модулей
 * (module-selection-v3) и проверка контента (/api/admin/content-check).
 *
 * Не путать с каталожной «Сложностью» (Video.difficulty, VideoDifficulty):
 * та нужна только чипам и фильтрам каталога и на подбор не влияет.
 */

import { Complexity, ComplexityLevel } from '@/generated/prisma';

/**
 * Уровни атлета — все значения, кроме «Любой»: ANY бывает только у видео
 * (атлету уровень считается из потенциала и всегда конкретный).
 */
export type AthleteComplexity = Exclude<Complexity, typeof Complexity.ANY>;

/** Подписи уровня подготовки — те же слова, что в форме видео в админке. */
export const COMPLEXITY_LABELS: Record<Complexity, string> = {
  [Complexity.BEGINNER]: 'Новичок',
  [Complexity.AMATEUR]: 'Любитель',
  [Complexity.ADVANCED]: 'Продвинутый',
  [Complexity.PRO]: 'Профи',
  [Complexity.ANY]: 'Любой',
};

const LEVEL_TO_COMPLEXITY: Record<ComplexityLevel, AthleteComplexity> = {
  [ComplexityLevel.BEGINNER]: Complexity.BEGINNER,
  [ComplexityLevel.AMATEUR]: Complexity.AMATEUR,
  [ComplexityLevel.ADVANCED]: Complexity.ADVANCED,
  [ComplexityLevel.PRO]: Complexity.PRO,
};

/**
 * Какие значения Video.complexity подходят атлету с этими допустимыми уровнями
 * (для фильтра `complexity: { in: … }`).
 *
 * «Любой» добавляется всегда: разминка, заминка и прочие универсальные видео
 * должны выпадать наравне с видео точного уровня, а не ждать последнего
 * фолбэка ANY_MODULE. Видео без уровня (NULL, «Не указано») сюда не попадают
 * намеренно — иначе все незаполненные ролики разом ушли бы во все уровни.
 */
export function complexityFilterForLevels(
  levels: readonly ComplexityLevel[]
): Complexity[] {
  const result = new Set<Complexity>();
  for (const level of levels) {
    const complexity = LEVEL_TO_COMPLEXITY[level];
    if (complexity) result.add(complexity);
  }
  result.add(Complexity.ANY);
  return Array.from(result);
}

/**
 * Подходит ли видео с уровнем `videoComplexity` атлету уровня `level`.
 * То же правило, что в complexityFilterForLevels, только для одного видео —
 * чтобы проверка контента не показывала ложных «дыр» там, где закрывает «Любой».
 */
export function videoFitsComplexity(
  videoComplexity: Complexity | null | undefined,
  level: AthleteComplexity
): boolean {
  return videoComplexity === level || videoComplexity === Complexity.ANY;
}
