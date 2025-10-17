# 🐛 Отладка проблемы с логином

## Проблема
После нажатия "Войти через Telegram":
- Открывается бот @trenkibot
- Бот не отправляет сообщение с кнопками подтверждения
- Страница /login остаётся в состоянии загрузки (polling)

## ✅ Что проверили

### 1. Webhook настроен правильно
```bash
curl 'https://api.telegram.org/bot{TOKEN}/getWebhookInfo'
# Result: url: "https://trenki.vercel.app/api/telegram" ✅
```

### 2. API endpoint работает
```bash
curl -X POST 'https://trenki.vercel.app/api/telegram' -d '{test_update}'
# Result: {"ok":true} ✅
```

### 3. Код логики правильный
- Deep link формируется: `https://t.me/trenkibot?start=login_{token}` ✅
- Бот проверяет параметр: `if (param && param.startsWith('login_'))` ✅
- Отправляет сообщение: `await sendMessage(chatId, loginMessage, keyboard)` ✅

## 🔍 Возможные причины

### 1. Vercel ещё не задеплоил новую версию
- **Решение:** Подождать 2-3 минуты после push
- **Проверка:** https://vercel.com/eskiimos/trenki/deployments

### 2. Environment variables не установлены
- `BOT_TOKEN` - нужен для отправки сообщений
- `NEXT_PUBLIC_BOT_USERNAME` - нужен для формирования deep link
- **Решение:** Добавить в Vercel Dashboard
- **Проверка:** Settings → Environment Variables

### 3. Webhook не доставляет updates
- Telegram может кешировать старый webhook
- **Решение:** Переустановить webhook

### 4. Бот блокирован пользователем
- Если пользователь заблокировал бота, он не может отправлять сообщения
- **Решение:** Разблокировать бота в Telegram

## 🔧 Действия для исправления

### Шаг 1: Проверить deployment в Vercel
```bash
# Откройте:
https://vercel.com/eskiimos/trenki/deployments

# Убедитесь, что последний commit задеплоен:
cfae1d6 - "debug: Добавлены логи для отладки Telegram бота"
```

### Шаг 2: Проверить Environment Variables
```bash
# Откройте:
https://vercel.com/eskiimos/trenki/settings/environment-variables

# Должны быть установлены:
✅ BOT_TOKEN = 8124848980:AAFEzFLBJhE9dOyDoxzKA7Zse4T_Hr4q9xU
✅ NEXT_PUBLIC_BOT_USERNAME = trenkibot
✅ DATABASE_URL
✅ KINESCOPE_API_KEY
```

### Шаг 3: Переустановить webhook (если нужно)
```bash
node webhook.js set
```

### Шаг 4: Проверить логи в Vercel
```bash
# После тестового запроса логина откройте:
https://vercel.com/eskiimos/trenki/logs

# Должны увидеть:
📨 Received Telegram update: {...}
📝 Message from {name}: /start login_{token}
🔍 Start command with param: login_{token}
🔐 Login request with token: {token}
📤 Sending login confirmation message...
✅ Message sent: {...}
```

### Шаг 5: Тестовый запрос
```bash
# 1. Откройте: https://trenki.vercel.app/login
# 2. Нажмите "Войти через Telegram"
# 3. В боте должно появиться сообщение с кнопками
# 4. Проверьте логи в Vercel
```

## 🆘 Если не помогло

### Вариант A: Тестировать локально
```bash
# 1. Запустите dev сервер:
npm run dev

# 2. Используйте ngrok для тестирования:
npx ngrok http 3001

# 3. Установите webhook на ngrok URL:
curl -X POST "https://api.telegram.org/bot{TOKEN}/setWebhook" \
  -d "url=https://your-ngrok-url.ngrok.io/api/telegram"

# 4. Протестируйте логин
```

### Вариант B: Проверить бота напрямую
```bash
# Отправьте команду боту вручную:
/start login_test123

# Если бот не отвечает - проблема в webhook или environment variables
```

### Вариант C: Проверить permissions
```bash
# Убедитесь, что бот не заблокирован:
# 1. Откройте @trenkibot в Telegram
# 2. Нажмите START (если есть)
# 3. Попробуйте отправить любое сообщение
```

## 📋 Чеклист перед production

- [ ] Vercel deployment завершён (commit cfae1d6)
- [ ] Environment variables установлены
- [ ] Webhook активен (trenki.vercel.app/api/telegram)
- [ ] Бот не заблокирован пользователем
- [ ] Логи показывают incoming updates
- [ ] Тестовый login работает

## 🎯 Следующие шаги

1. **Дождаться deployment** в Vercel (2-3 минуты)
2. **Проверить environment variables**
3. **Открыть логи** в Vercel
4. **Протестировать** логин снова
5. **Проверить логи** - должны увидеть updates от бота

Если после этого не работает - скинь скриншот логов из Vercel! 📸
