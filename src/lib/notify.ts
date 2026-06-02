/**
 * Унифицированная отправка нотификации: пытается Telegram, если ID валидный,
 * иначе (или при ошибке Telegram API) уходит в web-push через VAPID.
 *
 * Раньше cron слал только в Telegram, поэтому email-юзеры (telegramId=`email_...`)
 * не получали напоминания о тренировке вообще.
 */
import { isValidTelegramId, sendTelegramMessage } from '@/lib/telegram';
import { sendUserPush } from '@/lib/coach/push';

interface NotifyPayload {
  /** Заголовок (для push) */
  title: string;
  /** Короткое описание (для push) */
  body: string;
  /** Куда вести по клику (для push) */
  url?: string;
  /** Полный текст для Telegram (с эмодзи и форматированием) */
  telegramMessage: string;
  /** Опции для Telegram API: parse_mode, inline_keyboard и т.п. */
  telegramOptions?: {
    parseMode?: 'HTML' | 'Markdown';
    replyMarkup?: any;
  };
}

export type NotifyChannel = 'telegram' | 'push' | 'none';

export async function notifyUser(
  user: { id: string; telegramId: string | null },
  payload: NotifyPayload,
): Promise<NotifyChannel> {
  if (isValidTelegramId(user.telegramId)) {
    const result = await sendTelegramMessage(
      user.telegramId!,
      payload.telegramMessage,
      payload.telegramOptions,
    );
    if (result.success) return 'telegram';
    // Telegram упал — пробуем push как fallback
  }

  // Email-юзер или Telegram-ошибка → push. sendUserPush сам разрулит
  // отсутствие подписок (просто тихо вернётся).
  try {
    await sendUserPush(user.id, {
      title: payload.title,
      body: payload.body,
      url: payload.url,
    });
    return 'push';
  } catch (err) {
    console.error('[notifyUser] push fallback failed:', err);
    return 'none';
  }
}
