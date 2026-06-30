// Единые пороги приоритета пробелов для /admin/content-check.
// Используются и на бэке (подсчёт criticalGaps/importantGaps/desirableGaps),
// и на фронте (цвет/бейдж/фильтр) — чтобы числа на карточках, цвета и фильтр
// не расходились между собой.
export const PRIORITY_CRITICAL = 9; // priority >= 9 → критично
export const PRIORITY_IMPORTANT = 6; // priority 6..8 → важно; < 6 → желательно

export type PriorityTier = 'critical' | 'important' | 'desirable';

export function priorityTier(priority: number): PriorityTier {
  if (priority >= PRIORITY_CRITICAL) return 'critical';
  if (priority >= PRIORITY_IMPORTANT) return 'important';
  return 'desirable';
}
