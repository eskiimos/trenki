'use client';

// Глобальное открытие модалки подписки из любого места (тап платной фичи, ловля
// 402 SUBSCRIPTION_REQUIRED и т.п.). Хост — <SubscriptionModal/> в layout — слушает.

export type PaywallReason =
  | 'generic' // «оформи подписку» — общий поп-ап (п.3)
  | 'video' // видео-занятия
  | 'ai-workout' // быстрая ИИ-тренировка (квота исчерпана)
  | 'microcycle' // календарь/микроцикл
  | 'potential' // шкала потенциала
  | 'expiring'; // подписка скоро кончится (окно «что входит» при продлении)

type Listener = (open: boolean, reason: PaywallReason) => void;
const listeners = new Set<Listener>();

/** Открыть модалку подписки. reason влияет только на текст заголовка. */
export function openSubscriptionModal(reason: PaywallReason = 'generic') {
  listeners.forEach((l) => l(true, reason));
}

export function closeSubscriptionModal() {
  listeners.forEach((l) => l(false, 'generic'));
}

export function subscribeSubscriptionModal(l: Listener): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

/**
 * Если ответ — 402 SUBSCRIPTION_REQUIRED, открывает модалку и возвращает true
 * (значит, вызывающий может прервать свой обычный флоу). Иначе false.
 */
export async function handlePaywallResponse(res: Response, reason: PaywallReason = 'generic'): Promise<boolean> {
  if (res.status !== 402) return false;
  openSubscriptionModal(reason);
  return true;
}
