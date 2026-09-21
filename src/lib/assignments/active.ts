// «Активное» задание — то, что держит на главной кнопку «Мои задания» вместо
// ИИ-тренера (правка владельца «Середина сентября», п.10). Невыполненное задание,
// у которого срок прошёл не больше ACTIVE_OVERDUE_GRACE_DAYS назад: иначе одно
// забытое старое задание навсегда убрало бы ИИ-тренера с главной. Сами такие
// задания не исчезают — они остаются в списке «Мои задания».

export const ACTIVE_OVERDUE_GRACE_DAYS = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Нижняя граница срока для активных заданий (используется и в запросе к БД). */
export function activeDueCutoff(now: Date): Date {
  return new Date(now.getTime() - ACTIVE_OVERDUE_GRACE_DAYS * DAY_MS);
}

export function isActiveAssignment(a: { status: string; dueDate: Date | string }, now: Date): boolean {
  return a.status !== 'COMPLETED' && new Date(a.dueDate).getTime() >= activeDueCutoff(now).getTime();
}
