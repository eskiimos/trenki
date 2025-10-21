import { NextRequest, NextResponse } from 'next/server';

// Временное хранилище для pending login токенов (пользователь -> токен)
declare global {
  var pendingLoginTokens: Map<number, string>;
}

if (!global.pendingLoginTokens) {
  global.pendingLoginTokens = new Map();
}

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
    
    console.log('📨 Received Telegram update:', JSON.stringify(body, null, 2));
    
    // Обработка обычных сообщений
    if (body.message) {
      const message = body.message;
      const chatId = message.chat.id;
      const text = message.text;
      const firstName = message.from.first_name || 'друг';

      console.log(`📝 Message from ${firstName}: ${text}`);

      // Команда /start
      if (text?.startsWith('/start')) {
        const parts = text.split(' ');
        const param = parts[1]; // Токен после /start
        const userId = message.from.id;
        const userName = `${message.from.first_name || ''} ${message.from.last_name || ''}`.trim();
        const username = message.from.username;
        
        console.log(`🔍 Start command with param: ${param}`);
        
        // Если есть параметр - это токен для входа
        if (param) {
          console.log(`🔐 Login request with token: ${param.substring(0, 8)}... from user ${userId}`);
          
          // Проверяем, существует ли токен
          console.log('🔍 Checking login token:', param);
          console.log('🗂️ Available tokens:', Array.from(global.loginTokens?.keys() || []));
          
          if (!global.loginTokens || !global.loginTokens.has(param)) {
            console.log('❌ Token not found or expired:', param);
            await sendMessage(chatId, `❌ Неверная или устаревшая ссылка для входа.

Попробуйте войти снова через веб-приложение.`);
            return NextResponse.json({ ok: true });
          }

          console.log('✅ Token found, proceeding with authentication');

          // Создаем или обновляем пользователя в базе
          const prisma = (await import('@/lib/prisma')).prisma;
          
          // Генерируем email в формате {telegram_id}@t.me
          const autoEmail = `${userId}@t.me`;
          
          // Проверяем, существует ли пользователь
          let user = await prisma.user.findUnique({
            where: { telegramId: userId.toString() },
            include: { profile: true }
          });

          const needsOnboarding = !user || !user.profile || !user.profile.age || !user.profile.gender;

          // Если пользователя нет, создаем
          if (!user) {
            user = await prisma.user.create({
              data: {
                telegramId: userId.toString(),
                firstName: message.from.first_name || 'User',
                lastName: message.from.last_name || '',
                username: username,
                email: autoEmail,
                emailVerified: true, // Автоматически верифицируем Telegram email
              },
              include: { profile: true }
            });
            console.log(`✅ Created new user: ${user.id}`);
          } else if (!user.email) {
            // Обновляем email если его нет
            user = await prisma.user.update({
              where: { id: user.id },
              data: {
                email: autoEmail,
                emailVerified: true,
              },
              include: { profile: true }
            });
            console.log(`✅ Updated user email: ${autoEmail}`);
          }

          // Активируем токен
          const tokenData = global.loginTokens.get(param);
          if (tokenData) {
            console.log('📝 Current token data:', tokenData);
            
            tokenData.authenticated = true;
            tokenData.userId = userId.toString();
            tokenData.needsOnboarding = needsOnboarding;
            tokenData.userData = {
              telegramId: userId.toString(),
              firstName: message.from.first_name || 'User',
              lastName: message.from.last_name || '',
              username: username,
            };
            global.loginTokens.set(param, tokenData);
            
            console.log('✅ Token activated for user ${userId}:', {
              authenticated: tokenData.authenticated,
              userId: tokenData.userId,
              needsOnboarding: tokenData.needsOnboarding,
            });
          } else {
            console.log('⚠️ Token data not found after check!');
          }

          // Отправляем сообщение об успешном входе
          const successMessage = `✅ Вход подтвержден!

Теперь вы можете вернуться в приложение и продолжить работу.

📧 Ваш автоматический email: ${autoEmail}
${needsOnboarding ? '\n📝 При первом входе вам нужно будет завершить регистрацию.' : ''}

Приятных тренировок! 🏒`;

          await sendMessage(chatId, successMessage);
        } 
        else {
          // Обычный /start - показываем кнопку для запуска приложения
          const welcomeMessage = `👋 Привет, ${firstName}!

Добро пожаловать в Треньки - твой цифровой мир хоккея! 🏒

Нажми кнопку ниже, чтобы открыть приложение 👇`;

          const keyboard = {
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: '🚀 Открыть Треньки',
                    web_app: {
                      url: WEB_APP_URL
                    }
                  }
                ]
              ]
            }
          };

          await sendMessage(chatId, welcomeMessage, keyboard);
        }
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
      const telegramId = callbackQuery.from.id;

      // Обработка подтверждения входа
      if (data?.startsWith('confirm_login:')) {
        const token = data.replace('confirm_login:', '');
        
        console.log(`✅ Login confirmation for token: ${token.substring(0, 8)}...`);
        
        // Удаляем pending токен
        global.pendingLoginTokens.delete(telegramId);
        
        try {
          // Активируем токен - связываем его с telegram_id
          console.log(`📡 Activating token for Telegram ID: ${telegramId}`);
          
          const activateResponse = await fetch(`${WEB_APP_URL}/api/auth/activate-token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, telegramId })
          });
          
          console.log(`📊 Activation response status: ${activateResponse.status}`);
          
          if (activateResponse.ok) {
            console.log('✅ Token activated successfully');
            
            const successMessage = `
✅ **Вход подтверждён!**

Вы успешно авторизовались в приложении **Trenki**.

Теперь вы можете вернуться в браузер - вход будет выполнен автоматически.

Или нажмите кнопку ниже, чтобы открыть приложение прямо сейчас! 👇
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
            
            await editMessage(chatId, messageId, successMessage, keyboard);
            await answerCallbackQuery(callbackQuery.id);
          } else {
            await editMessage(chatId, messageId, '❌ Ошибка активации токена. Токен истёк или уже использован.');
            await answerCallbackQuery(callbackQuery.id);
          }
        } catch (error) {
          console.error('Error confirming login:', error);
          await editMessage(chatId, messageId, '❌ Произошла ошибка. Попробуйте запросить вход заново.');
          await answerCallbackQuery(callbackQuery.id);
        }
      }
      
      // Обработка отмены входа
      else if (data?.startsWith('cancel_login:')) {
        // Удаляем pending токен
        global.pendingLoginTokens.delete(telegramId);
        
        const cancelMessage = `
❌ **Вход отменён**

Запрос на вход был отменён.

Если вы не запрашивали вход, всё в порядке - ваша безопасность не нарушена.

Чтобы открыть приложение, отправьте /start
        `;
        
        await editMessage(chatId, messageId, cancelMessage);
        await answerCallbackQuery(callbackQuery.id);
      }
      
      else if (data === 'about') {
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
