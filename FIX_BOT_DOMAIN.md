# 🚨 СРОЧНО: Настройка домена в BotFather

## ⚠️ Проблема: "Bot domain invalid"

Это происходит потому, что домен **НЕ НАСТРОЕН** в BotFather.

---

## 🔧 Решение (займёт 2 минуты)

### Шаг 1: Откройте Telegram

1. Откройте приложение Telegram на телефоне или компьютере
2. В поиске введите: **@BotFather**
3. Откройте чат с ботом

### Шаг 2: Отправьте команду `/setdomain`

Просто отправьте это сообщение боту:

```
/setdomain
```

BotFather ответит списком ваших ботов или попросит выбрать бота.

### Шаг 3: Выберите бота `@trenkibot`

Отправьте:

```
@trenkibot
```

или

```
trenkibot
```

(без @ тоже работает)

### Шаг 4: Укажите домен

BotFather попросит указать домен. Отправьте **ТОЧНО ТАК**:

```
trenki.vercel.app
```

**ВАЖНО:**
- ❌ НЕ пишите `https://trenki.vercel.app`
- ❌ НЕ пишите `trenki.vercel.app/login`
- ✅ Только `trenki.vercel.app`

### Шаг 5: Подтверждение

BotFather ответит что-то вроде:

```
✅ Success! Users will be able to log in from:
trenki.vercel.app
```

---

## 📱 Полная последовательность сообщений

Вот что вы должны отправить в BotFather:

```
1️⃣ Вы: /setdomain
2️⃣ BotFather: Choose a bot...
3️⃣ Вы: @trenkibot
4️⃣ BotFather: Send me the domain...
5️⃣ Вы: trenki.vercel.app
6️⃣ BotFather: ✅ Success!
```

---

## ✅ После настройки

1. **Подождите 30 секунд** (иногда нужно время на обновление)
2. **Откройте в браузере:**
   ```
   https://trenki.vercel.app/login
   ```
3. **Очистите кеш:** Ctrl+Shift+R (Windows) или Cmd+Shift+R (Mac)
4. **Проверьте:** Должна появиться синяя кнопка "Log in via Telegram"

---

## 🎯 Быстрая команда

Скопируйте и отправьте боту по очереди:

```
/setdomain
@trenkibot
trenki.vercel.app
```

---

## ❓ Что-то пошло не так?

### Проблема: BotFather не отвечает
**Решение:** Нажмите `/start` сначала

### Проблема: "Invalid domain"
**Решение:** Убедитесь, что НЕ пишете `https://` и пути

### Проблема: Бот не в списке
**Решение:** Проверьте, что бот создан и вы — его владелец

### Проблема: После настройки всё равно ошибка
**Решение:**
1. Подождите 1-2 минуты
2. Очистите кеш браузера (Ctrl+Shift+R)
3. Попробуйте в режиме инкогнито

---

## 🔍 Проверка настройки

После настройки можно проверить через API:

```bash
curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo"
```

Хотя для Login Widget это не обязательно, но можно проверить что бот работает.

---

## 📸 Как должно выглядеть

### В BotFather:

```
You: /setdomain

BotFather: Choose a bot to set domain.
Send one of the following commands:
/done - finish this conversation
@trenkibot - Треньки

You: @trenkibot

BotFather: Send me the domain name where your users 
will be able to log in via Telegram.
Example: example.com

You: trenki.vercel.app

BotFather: ✅ Success! Users will be able to log in from:
trenki.vercel.app
```

---

## 🚀 ДАВАЙ СДЕЛАЕМ СЕЙЧАС!

1. Открой Telegram
2. Найди @BotFather
3. Отправь `/setdomain`
4. Отправь `@trenkibot`
5. Отправь `trenki.vercel.app`
6. Дождись подтверждения ✅

**После этого обнови страницу `/login` и всё заработает!** 🎉

---

**Последнее обновление:** 17 октября 2025 г.
