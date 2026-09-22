// Тексты напоминаний о тренировке. Вариант выбирается детерминированно по
// локальной дате юзера — так один и тот же человек в один день видит один текст,
// а изо дня в день они чередуются. Без новых полей в БД и без рандома
// (рандом ломал бы воспроизводимость и тесты). Сами тексты — шаблоны
// dailyReminder1/2, их редактирует админ (./templates.ts).

import {
  DEFAULT_PUSH_TEMPLATES,
  renderPush,
  type PushTemplateKey,
  type PushTemplates,
} from '@/lib/notifications/templates';

export const DAILY_REMINDER_TEMPLATES: PushTemplateKey[] = ['dailyReminder1', 'dailyReminder2'];

/**
 * Индекс варианта по локальной дате (YYYY-MM-DD) и id пользователя.
 * Дата даёт чередование по дням, userId — чтобы не все получали одинаковый
 * текст в один день (иначе рассылка выглядит как «шаблон»).
 */
export function pickReminderVariantIndex(localDate: string, userId: string, total: number): number {
  if (total <= 1) return 0;
  let h = 0;
  const s = `${localDate}:${userId}`;
  for (let i = 0; i < s.length; i += 1) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % total;
}

/** Готовый текст напоминания на конкретный день. */
export function buildDailyReminder(
  localDate: string,
  userId: string,
  name: string | null,
  dayLabel: string,
  templates: PushTemplates = DEFAULT_PUSH_TEMPLATES,
): { title: string; body: string } {
  const idx = pickReminderVariantIndex(localDate, userId, DAILY_REMINDER_TEMPLATES.length);
  return renderPush(templates, DAILY_REMINDER_TEMPLATES[idx]!, { name, day: dayLabel });
}
