import { NextRequest, NextResponse } from 'next/server';

// Типы для Telegram API
interface TelegramMessage {
  message_id: number;
  from: {
    id: number;
    first_name?: string;
    last_name?: string;
    username?: string;
  };
  chat: {
    id: number;
    type: string;
  };
  text?: string;
}

interface TelegramCallbackQuery {
  id: string;
  from: {
    id: number;
    first_name?: string;
    last_name?: string;
    username?: string;
  };
  message: TelegramMessage;
  data?: string;
}

interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
}

interface InlineKeyboard {
  reply_markup: {
    inline_keyboard: Array<Array<{
      text: string;
      web_app?: { url: string };
      callback_data?: string;
    }>>;
  };
}

const BOT_TOKEN = process.env.BOT_TOKEN;
const WEB_APP_URL = process.env.WEB_APP_URL || 'https://trenki.vercel.app';

// Функция отправки сообщения в Telegram
async function sendMessage(chatId: number, text: string, replyMarkup?: InlineKeyboard) {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  
  const body = {
    chat_id: chatId,
    text,
    parse_mode: 'Markdown',
    ...replyMarkup
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  return response.json();
}

// Функция редактирования сообщения
async function editMessage(chatId: number, messageId: number, text: string, replyMarkup?: InlineKeyboard) {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/editMessageText`;
  
  const body = {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: 'Markdown',
    ...replyMarkup
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  return response.json();
}

// Функция ответа на callback query
async function answerCallbackQuery(callbackQueryId: string) {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: callbackQueryId })
  });

  return response.json();
}

export async function POST(request: NextRequest) {
  try {
    const body: TelegramUpdate = await request.json();
    
    // Обработка обычных сообщений
    if (body.message) {
      const message = body.message;
      const chatId = message.chat.id;
      const text = message.text;
      const firstName = message.from.first_name || 'друг';

      // Команда /start
      if (text === '/start') {
        const welcomeMessage = `
👋 Привет, ${firstName}!

Добро пожаловать в **Trenki** - социальную сеть для тренировок! 💪

🔥 Здесь вы можете:
• Смотреть короткие видео тренировок 
• Изучать упражнения от профессиональных тренеров
• Делиться своими результатами
• Находить единомышленников

Готовы начать тренировки? Нажмите кнопку ниже! 👇
        `;

        const keyboard = {
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: '🚀 Открыть Trenki',
                  web_app: {
                    url: WEB_APP_URL
                  }
                }
              ],
              [
                {
                  text: '💪 О приложении',
                  callback_data: 'about'
                },
                {
                  text: '❓ Помощь',
                  callback_data: 'help'
                }
              ]
            ]
          }
        };

        await sendMessage(chatId, welcomeMessage, keyboard);
      } 
      // Другие сообщения
      else {
        const responseMessage = `
Привет! 👋 

Я бот приложения **Trenki** - социальной сети для тренировок! 

Чтобы начать пользоваться приложением, отправьте команду /start

💪 Удачных тренировок!
        `;

        const keyboard = {
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: '🚀 Открыть Trenki',
                  web_app: {
                    url: WEB_APP_URL
                  }
                }
              ]
            ]
          }
        };

        await sendMessage(chatId, responseMessage, keyboard);
      }
    }

    // Обработка callback queries (кнопки)
    if (body.callback_query) {
      const callbackQuery = body.callback_query;
      const message = callbackQuery.message;
      const data = callbackQuery.data;
      const chatId = message.chat.id;
      const messageId = message.message_id;
      const firstName = callbackQuery.from.first_name || 'друг';

      if (data === 'about') {
        const aboutMessage = `
📱 **О приложении Trenki**

Trenki - это современная платформа для фитнеса с функционалом как у TikTok/Instagram Shorts, но для тренировок!

✨ **Особенности:**
• Короткие видео тренировок (15-60 сек)
• Swipe навигация между упражнениями  
• Профессиональные тренеры
• Интерактивные тренировки
• Социальные функции

🎯 **Для кого:**
• Новички в фитнесе
• Опытные спортсмены
• Тренеры и инструкторы
• Всех, кто хочет быть в форме!

Присоединяйтесь к сообществу здорового образа жизни! 💪
        `;

        const backKeyboard = {
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: '🚀 Открыть Trenki',
                  web_app: {
                    url: WEB_APP_URL
                  }
                }
              ],
              [
                {
                  text: '⬅️ Назад',
                  callback_data: 'back_to_start'
                }
              ]
            ]
          }
        };

        await editMessage(chatId, messageId, aboutMessage, backKeyboard);
      }

      if (data === 'help') {
        const helpMessage = `
❓ **Помощь по использованию**

**Как пользоваться приложением:**

1. 🚀 Нажмите "Открыть Trenki" 
2. 📱 Приложение откроется прямо в Telegram
3. 👆 Листайте видео свайпом вверх/вниз
4. ❤️ Ставьте лайки понравившимся тренировкам
5. 💬 Читайте комментарии и советы

**Основные разделы:**
• 🏠 Главная - лента тренировок
• 🎬 Видео - полные тренировки  
• 📱 Shorts - короткие ролики

**Проблемы?**
Напишите команду /start для перезапуска бота

Удачных тренировок! 💪
        `;

        const backKeyboard = {
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: '🚀 Открыть Trenki',
                  web_app: {
                    url: WEB_APP_URL
                  }
                }
              ],
              [
                {
                  text: '⬅️ Назад',
                  callback_data: 'back_to_start'
                }
              ]
            ]
          }
        };

        await editMessage(chatId, messageId, helpMessage, backKeyboard);
      }

      if (data === 'back_to_start') {
        const welcomeMessage = `
👋 Привет, ${firstName}!

Добро пожаловать в **Trenki** - социальную сеть для тренировок! 💪

🔥 Здесь вы можете:
• Смотреть короткие видео тренировок 
• Изучать упражнения от профессиональных тренеров
• Делиться своими результатами
• Находить единомышленников

Готовы начать тренировки? Нажмите кнопку ниже! 👇
        `;

        const keyboard = {
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: '🚀 Открыть Trenki',
                  web_app: {
                    url: WEB_APP_URL
                  }
                }
              ],
              [
                {
                  text: '💪 О приложении',
                  callback_data: 'about'
                },
                {
                  text: '❓ Помощь',
                  callback_data: 'help'
                }
              ]
            ]
          }
        };

        await editMessage(chatId, messageId, welcomeMessage, keyboard);
      }

      await answerCallbackQuery(callbackQuery.id);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Ошибка обработки webhook:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
