import { pushTag } from '@/lib/notifications/push-tag';

// Пуши о заданиях тренера. Тексты собраны в одном месте: по решению владельца
// (21.09) тексты уведомлений станут редактируемыми в админке — подменять их
// придётся только здесь, роуты заданий трогать не нужно.
// Эмодзи в тексте допустимы: пуш — системное уведомление, не экран приложения.

export const ASSIGNMENT_NEW_PUSH_TEXT = {
  title: 'Задание от тренера!',
  body: 'Привет, чемпион! Тебе прилетела тренировка от тренера. Вперёд к выполнению 💪',
} as const;

/** Атлету: тренер назначил задание. Повторное задание заменяет прошлый пуш в шторке. */
export function assignmentNewPush() {
  return {
    title: ASSIGNMENT_NEW_PUSH_TEXT.title,
    body: ASSIGNMENT_NEW_PUSH_TEXT.body,
    url: '/profile/assignments',
    tag: pushTag('assignment-new'),
  };
}

/**
 * Тренеру: атлет закрыл задание. Метка — на атлета, чтобы «Ваня выполнил»
 * не затиралось следующим «Петя выполнил».
 */
export function assignmentDonePush(athlete: { id: string; name: string }) {
  return {
    title: 'Задание выполнено',
    body: `${athlete.name} закрыл назначенную тренировку`,
    url: '/coach/assignments',
    tag: pushTag('assignment-done', athlete.id),
  };
}
