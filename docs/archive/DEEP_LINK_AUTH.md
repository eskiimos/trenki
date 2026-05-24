# 🔐 Deep Link Авторизация через Telegram

## ✅ Реализовано

Новый способ авторизации **без зависимости от Telegram Login Widget** и настройки домена в BotFather.

## 🎯 Как это работает

### 1. Пользователь открывает страницу логина
- URL: https://trenki.vercel.app/login
- Генерируется уникальный `login_token` (действителен 5 минут)
- Показывается кнопка **"Войти через Telegram"**

### 2. Клик на кнопку
- Опрывается deep link: `https://t.me/trenkiapp_bot?start=login_{token}`
- Пользователь переходит в Telegram бота
- Начинается polling на веб-странице (проверка каждые 2 секунды)

### 3. В Telegram боте
- Бот получает команду `/start login_{token}`
- Бот активирует токен, связывая его с `telegram_id` пользователя
- Бот отправляет сообщение с кнопкой **"✅ Подтвердить и открыть"**

### 4. Подтверждение
- Пользователь нажимает кнопку в боте
- Открывается Web App с авторизованным пользователем
- Или: polling на веб-странице обнаруживает активацию токена
- Автоматическая авторизация и редирект на главную

## 📋 Технические детали

### API Endpoints

#### `POST /api/auth/login-token`
Генерирует новый login токен.

**Response:**
```json
{
  "token": "abc123..."
}
```

#### `GET /api/auth/login-token?token={token}`
Проверяет статус токена.

**Response (pending):**
```json
{
  "status": "pending",
  "message": "Waiting for user confirmation in Telegram"
}
```

**Response (success):**
```json
{
  "status": "success",
  "telegramId": "123456789"
}
```

#### `POST /api/auth/activate-token`
Активирует токен (вызывается ботом).

**Request:**
```json
{
  "token": "abc123...",
  "telegramId": 123456789
}
```

**Response:**
```json
{
  "success": true
}
```

### Бот обработка

Файл: `src/app/api/telegram/route.ts`

```typescript
if (text?.startsWith('/start')) {
  const param = parts[1];
  
  if (param && param.startsWith('login_')) {
    const token = param.replace('login_', '');
    
    // Активируем токен
    await fetch(`${WEB_APP_URL}/api/auth/activate-token`, {
      method: 'POST',
      body: JSON.stringify({ token, telegramId })
    });
    
    // Отправляем кнопку подтверждения
    const keyboard = {
      inline_keyboard: [[{
        text: '✅ Подтвердить и открыть',
        web_app: { url: `${WEB_APP_URL}?login_token=${token}` }
      }]]
    };
  }
}
```

### Хранилище токенов

**Текущее решение:** In-memory (глобальная Map)
```typescript
global.loginTokensStore = new Map<string, {
  telegramId?: string;
  expiresAt: number;
}>();
```

**Для продакшена:** Рекомендуется использовать Redis
- Позволит масштабироваться на несколько серверов
- Персистентное хранилище
- TTL встроенный

## ⚡ Преимущества

✅ **Не требует настройки домена в BotFather**
✅ **Работает на любом домене**
✅ **Простая реализация**
✅ **Хорошая UX** - пользователь остаётся в Telegram
✅ **Безопасно** - токены одноразовые с истечением (5 минут)

## 🔒 Безопасность

1. **Токены одноразовые** - после использования удаляются
2. **Срок действия 5 минут** - автоматическое истечение
3. **Связь с telegram_id** - токен активируется только один раз
4. **Автоматическая очистка** - истёкшие токены удаляются каждую минуту

## 📱 Для продакшена

### 1. Настройте Redis (опционально, но рекомендуется)

```bash
npm install redis
```

```typescript
import { createClient } from 'redis';

const redis = createClient({
  url: process.env.REDIS_URL
});

await redis.setEx(`login:${token}`, 300, JSON.stringify({
  telegramId,
  expiresAt: Date.now() + 300000
}));
```

### 2. Environment Variables

Убедитесь, что установлены:
- `BOT_TOKEN` - токен бота
- `NEXT_PUBLIC_BOT_USERNAME` - имя бота (trenkiapp_bot)
- `WEB_APP_URL` - URL приложения (https://trenki.vercel.app)

### 3. Webhook

Webhook уже настроен на `trenki.vercel.app`:
```bash
node webhook.js set
```

## 🧪 Тестирование

### Локально:
1. Запустите dev сервер: `npm run dev`
2. Откройте: http://localhost:3001/login
3. Нажмите "Войти через Telegram"
4. Откроется бот @trenkibot
5. Нажмите кнопку подтверждения

### Production:
1. Откройте: https://trenki.vercel.app/login
2. Те же шаги

## ❓ FAQ

**Q: Почему не используется Telegram Login Widget?**
A: Требует настройки домена в BotFather, не работает на localhost, проблемы с "Bot domain invalid".

**Q: Безопасно ли хранить токены в памяти?**
A: Для MVP - да. Для продакшена лучше использовать Redis.

**Q: Что если пользователь не подтвердит вход?**
A: Токен истечёт через 5 минут. Нужно будет сгенерировать новый.

**Q: Можно ли использовать на нескольких доменах?**
A: Да! Не требуется настройка в BotFather.

## 🎉 Готово!

Deep Link авторизация реализована и готова к использованию!
