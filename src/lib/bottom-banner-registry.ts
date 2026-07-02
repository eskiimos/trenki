'use client';

// Координация нижних fixed-баннеров на главной, чтобы они не налезали друг на
// друга. Каждый видимый баннер регистрирует свой ПРИОРИТЕТ (больше = важнее).
// Низкоприоритетные (напр. «установи приложение») прячутся, пока висит кто-то
// важнее (напр. напоминание о тренировке). Появляются, когда важный уходит.

export const BANNER_PRIORITY = {
  workoutReminder: 100,
  install: 10,
} as const;

const active = new Map<string, number>(); // id -> priority
const subs = new Set<() => void>();

function notify() {
  subs.forEach((cb) => cb());
}

/** Регистрирует баннер как видимый. Возвращает функцию снятия регистрации. */
export function registerBanner(id: string, priority: number): () => void {
  active.set(id, priority);
  notify();
  return () => {
    active.delete(id);
    notify();
  };
}

/** Наивысший приоритет среди активных баннеров, кроме указанного id. */
export function highestActivePriority(exceptId?: string): number {
  let max = -Infinity;
  for (const [id, p] of active) {
    if (id !== exceptId && p > max) max = p;
  }
  return max;
}

/** Подписка на изменения реестра (для перерисовки зависящих баннеров). */
export function subscribeBanners(cb: () => void): () => void {
  subs.add(cb);
  return () => {
    subs.delete(cb);
  };
}
