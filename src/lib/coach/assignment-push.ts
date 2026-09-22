import { pushTag } from '@/lib/notifications/push-tag';
import { DEFAULT_PUSH_TEMPLATES, renderPush, type PushTemplates } from '@/lib/notifications/templates';

// Пуши о заданиях тренера. Текст атлету — шаблон assignmentNew, его редактирует
// админ (решение владельца 21.09). Эмодзи в тексте допустимы: пуш — системное
// уведомление, не экран приложения.

/** Атлету: тренер назначил задание. Повторное задание заменяет прошлый пуш в шторке. */
export function assignmentNewPush(
  templates: PushTemplates = DEFAULT_PUSH_TEMPLATES,
  vars: { name?: string | null; coach?: string | null } = {},
) {
  return {
    ...renderPush(templates, 'assignmentNew', vars),
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
