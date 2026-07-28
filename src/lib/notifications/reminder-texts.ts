// Тексты напоминаний о тренировке. Вариант выбирается детерминированно по
// локальной дате юзера — так один и тот же человек в один день видит один текст,
// а изо дня в день они чередуются. Без новых полей в БД и без рандома
// (рандом ломал бы воспроизводимость и тесты).

export interface ReminderVariant {
  title: (name: string | null) => string;
  body: (dayLabel: string) => string;
}

export const DAILY_REMINDER_VARIANTS: ReminderVariant[] = [
  {
    title: (name) => (name ? `Привет, ${name}! Время тренировки 💪` : 'Время тренировки 💪'),
    body: (dayLabel) =>
      `Стабильность — признак мастерства. Не забудь потренироваться — сегодня у тебя «${dayLabel}».`,
  },
  {
    title: (name) => (name ? `${name}, дисциплина бьёт класс! 🔥` : 'Дисциплина бьёт класс! 🔥'),
    body: (dayLabel) => `Пора тренироваться! Сегодня у тебя «${dayLabel}».`,
  },
];

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
): { title: string; body: string } {
  const idx = pickReminderVariantIndex(localDate, userId, DAILY_REMINDER_VARIANTS.length);
  const v = DAILY_REMINDER_VARIANTS[idx]!;
  return { title: v.title(name), body: v.body(dayLabel) };
}
