import { GOAL_LABELS, ENERGY_STATE_LABELS } from '@/lib/training-algorithm-v3';

/**
 * Человекочитаемое название составленной тренировки: «цель · состояние».
 * Напр. «Убегаем от соперника · Лёгкая нагрузка». Если параметров нет (старые
 * сессии до миграции) — отдаём нейтральное имя, чтобы UI не показывал пустоту.
 */
export function workoutTitle(goal?: string | null, energyState?: string | null): string {
  const g = goal ? GOAL_LABELS[goal]?.label : null;
  const e = energyState ? ENERGY_STATE_LABELS[energyState]?.label : null;
  if (g && e) return `${g} · ${e}`;
  if (g) return g;
  if (e) return `Тренировка · ${e}`;
  return 'Тренировка от ИИ-тренера';
}
