// Утилиты для отправки сообщений в Telegram

const BOT_TOKEN = process.env.BOT_TOKEN;

/**
 * Отправить сообщение пользователю в Telegram
 */
export async function sendTelegramMessage(
  telegramId: string,
  message: string,
  options?: {
    replyMarkup?: any;
    parseMode?: 'HTML' | 'Markdown';
  }
) {
  if (!BOT_TOKEN) {
    console.error('❌ BOT_TOKEN not configured');
    return { success: false, error: 'Bot token not configured' };
  }

  try {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
    
    const payload: any = {
      chat_id: telegramId,
      text: message,
    };

    if (options?.parseMode) {
      payload.parse_mode = options.parseMode;
    }

    if (options?.replyMarkup) {
      payload.reply_markup = options.replyMarkup;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!data.ok) {
      console.error('❌ Telegram API error:', data);
      return { success: false, error: data.description };
    }

    console.log('✅ Message sent to', telegramId);
    return { success: true, messageId: data.result.message_id };
  } catch (error: any) {
    console.error('❌ Error sending Telegram message:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Форматировать дату и время для уведомления
 */
export function formatWorkoutTime(date: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const workoutDate = new Date(date);
  const workoutDay = new Date(workoutDate.getFullYear(), workoutDate.getMonth(), workoutDate.getDate());
  
  let dayText = '';
  if (workoutDay.getTime() === today.getTime()) {
    dayText = 'Сегодня';
  } else if (workoutDay.getTime() === tomorrow.getTime()) {
    dayText = 'Завтра';
  } else {
    const options: Intl.DateTimeFormatOptions = { 
      day: 'numeric', 
      month: 'long',
      weekday: 'short'
    };
    dayText = workoutDate.toLocaleDateString('ru-RU', options);
  }
  
  const timeText = workoutDate.toLocaleTimeString('ru-RU', { 
    hour: '2-digit', 
    minute: '2-digit' 
  });
  
  return `${dayText} в ${timeText}`;
}
