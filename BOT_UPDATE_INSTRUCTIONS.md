# 🤖 Обновление Telegram бота - Инструкция

## ✅ Что уже сделано локально:

1. ✅ Обновлен токен в `.env.local`: `8405285944:AAHmnub0gtc4tKhPdU8njuIf4cgga8AczC8`
2. ✅ Обновлен токен в `.env.production`: `8405285944:AAHmnub0gtc4tKhPdU8njuIf4cgga8AczC8`
3. ✅ Обновлен username бота: `trenkiapp_bot` (было: `trenkibot`)
4. ✅ Webhook настроен: `https://trenki.app/api/telegram`
5. ✅ Токен проверен и работает ✅

---

## 📋 Информация о новом боте:

- **Имя:** TRENKI.APP
- **Username:** @trenkiapp_bot
- **Bot ID:** 8405285944
- **Token:** `8405285944:AAHmnub0gtc4tKhPdU8njuIf4cgga8AczC8`

---

## 🚀 Что нужно сделать дальше:

### 1️⃣ Обновить переменные на сервере (если используется)

```bash
# Подключитесь к серверу
ssh ваш_пользователь@ваш_сервер

# Перейдите в директорию проекта
cd /путь/к/проекту

# Отредактируйте .env файл
nano .env

# Найдите и замените:
BOT_TOKEN="старый_токен"
NEXT_PUBLIC_BOT_USERNAME="trenkibot"

# На новые значения:
BOT_TOKEN="8405285944:AAHmnub0gtc4tKhPdU8njuIf4cgga8AczC8"
NEXT_PUBLIC_BOT_USERNAME="trenkiapp_bot"

# Сохраните: Ctrl+O, Enter, Ctrl+X

# Перезапустите приложение
pm2 restart all
# или если используется systemd:
systemctl restart trenki

# Проверьте логи
pm2 logs
```

---

### 2️⃣ Обновить переменные в Vercel

1. Откройте [Vercel Dashboard](https://vercel.com/dashboard)
2. Выберите проект `trenki`
3. Перейдите в **Settings** → **Environment Variables**
4. Найдите и обновите:

   **BOT_TOKEN:**
   - Старое значение: удалите
   - Новое значение: `8405285944:AAHmnub0gtc4tKhPdU8njuIf4cgga8AczC8`
   - Применить к: Production, Preview, Development

   **NEXT_PUBLIC_BOT_USERNAME:**
   - Старое значение: `trenkibot`
   - Новое значение: `trenkiapp_bot`
   - Применить к: Production, Preview, Development

5. Нажмите **Save**
6. Выполните **Redeploy** проекта:
   - Перейдите в **Deployments**
   - Найдите последний деплой
   - Нажмите **...** → **Redeploy**

---

### 3️⃣ Проверка работы

После обновления проверьте:

#### A) Проверка бота через API:
```bash
curl "https://api.telegram.org/bot8405285944:AAHmnub0gtc4tKhPdU8njuIf4cgga8AczC8/getMe"
```

Должен вернуть информацию о боте TRENKI.APP

#### B) Проверка webhook:
```bash
curl "https://api.telegram.org/bot8405285944:AAHmnub0gtc4tKhPdU8njuIf4cgga8AczC8/getWebhookInfo"
```

Должно быть:
- `"url": "https://trenki.app/api/telegram"`
- `"pending_update_count": 0`

#### C) Проверка в приложении:

1. Откройте https://trenki.app
2. Попробуйте войти через Telegram
3. Нажмите кнопку "Login with Telegram"
4. Должно открыться окно авторизации с ботом **@trenkiapp_bot**

---

## ⚠️ Важные заметки:

### Старый бот (@trenkibot)

Старый бот можно:
- Удалить через @BotFather (команда `/deletebot`)
- Или оставить, но он больше не будет использоваться

### Telegram Login Widget

Виджет авторизации автоматически обновится, так как использует `NEXT_PUBLIC_BOT_USERNAME` из переменных окружения.

### Миграция пользователей

⚠️ **ВНИМАНИЕ:** Если у вас уже есть пользователи, которые авторизовались через старого бота:
- Telegram ID пользователей остаются теми же
- Данные в базе данных не изменятся
- Пользователи смогут войти через нового бота с теми же учетными записями

---

## 📝 Чек-лист обновления:

- [x] Локальный `.env.local` обновлен
- [x] Локальный `.env.production` обновлен
- [x] Webhook настроен
- [x] Бот проверен и работает
- [ ] `.env` на сервере обновлен
- [ ] Приложение на сервере перезапущено
- [ ] Vercel Environment Variables обновлены
- [ ] Redeploy на Vercel выполнен
- [ ] Авторизация через Telegram протестирована
- [ ] Пользователи уведомлены о смене бота (если нужно)

---

## 🔄 Откат (если что-то пошло не так)

Если новый бот не работает, можно быстро вернуться к старому:

```bash
# Верните старые значения:
BOT_TOKEN="8124848980:AAE6ZD6wkWPsCmEKNq2a68gHVo58p4D7Jp4"
NEXT_PUBLIC_BOT_USERNAME="trenkibot"

# Перезапустите приложение
pm2 restart all

# Настройте webhook для старого бота:
curl -X POST "https://api.telegram.org/bot8124848980:AAE6ZD6wkWPsCmEKNq2a68gHVo58p4D7Jp4/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://trenki.app/api/telegram"}'
```

⚠️ **НО ПОМНИТЕ:** Старый токен был скомпрометирован, поэтому лучше использовать новый бот!

---

**Дата обновления:** 22 декабря 2025  
**Старый бот:** @trenkibot  
**Новый бот:** @trenkiapp_bot
