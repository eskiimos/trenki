# 🚨 ИНСТРУКЦИЯ ПО ВОССТАНОВЛЕНИЮ БЕЗОПАСНОСТИ

## ✅ Что уже сделано:

1. ✅ Все токены удалены из файлов проекта
2. ✅ Git история очищена от токенов (189 коммитов переписано)
3. ✅ Создан бэкап проекта: `trenki-1-backup-20251222_094035`
4. ✅ Файлы документации восстановлены с безопасными заглушками

---

## 🚨 ЧТО НУЖНО СДЕЛАТЬ СРОЧНО:

### Шаг 1: Отозвать скомпрометированные токены

#### A) Telegram Bot Token

1. Откройте Telegram и найдите **@BotFather**
2. Отправьте команду: `/mybots`
3. Выберите вашего бота (trenkibot)
4. Нажмите **"API Token"**
5. Нажмите **"Revoke current token"** ⚠️ ВАЖНО!
6. Подтвердите отзыв токена
7. Нажмите **"Generate new token"**
8. **СОХРАНИТЕ новый токен** - он понадобится дальше

#### B) Kinescope API Key

1. Зайдите на [kinescope.io](https://kinescope.io)
2. Перейдите в **Settings → API**
3. Удалите старый API ключ
4. Создайте новый API ключ
5. **СОХРАНИТЕ новый ключ**

---

### Шаг 2: Обновить переменные окружения

#### A) Локально (для разработки)

Создайте/обновите файл `.env.local`:

```env
# Telegram Bot
BOT_TOKEN="ваш_новый_токен_от_botfather"
NEXT_PUBLIC_BOT_USERNAME="trenkibot"
NEXT_PUBLIC_APP_URL="https://trenki.app"

# Kinescope
KINESCOPE_API_KEY="ваш_новый_kinescope_ключ"

# Database (Prisma Accelerate)
DATABASE_URL="prisma+postgres://accelerate.prisma-data.net/?api_key=ваш_ключ"

NODE_ENV="development"
```

#### B) На сервере (Production)

Обновите `.env` файл на сервере:

```bash
# Подключитесь к серверу
ssh ваш_пользователь@ваш_сервер

# Отредактируйте .env
cd /путь/к/проекту
nano .env

# Вставьте НОВЫЕ токены (такие же как в .env.local)
# Сохраните: Ctrl+O, Enter, Ctrl+X

# Перезапустите приложение
pm2 restart all
# или
systemctl restart trenki
```

#### C) Vercel/Хостинг Environment Variables

1. Откройте [Vercel Dashboard](https://vercel.com/dashboard)
2. Выберите проект `trenki`
3. Перейдите в **Settings → Environment Variables**
4. Обновите следующие переменные с НОВЫМИ значениями:
   - `BOT_TOKEN` - новый токен бота
   - `KINESCOPE_API_KEY` - новый ключ Kinescope
5. Нажмите **"Save"**
6. Выполните **Redeploy** проекта

---

### Шаг 3: Обновить GitHub репозиторий

⚠️ **ВАЖНО:** Это удалит всю старую историю с токенами из GitHub!

```bash
cd /Users/bahtiarmingazov/Desktop/Проекты/trenki-1

# Убедитесь, что вы на ветке main
git branch

# Force push с очищенной историей
git push origin main --force

# Также очистите все другие ветки если они есть
git push origin --all --force
git push origin --tags --force
```

**После push:**
1. Зайдите на https://github.com/eskiimos/trenki
2. Проверьте, что старые токены больше не видны в истории коммитов
3. Можете использовать GitHub поиск для проверки: найдите "8124848980" - должно быть 0 результатов

---

### Шаг 4: Настроить Webhook (если используется)

После получения нового BOT_TOKEN обновите webhook:

```bash
# Замените <NEW_BOT_TOKEN> на ваш новый токен
curl -X POST "https://api.telegram.org/bot<NEW_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://trenki.app/api/telegram"}'

# Проверьте webhook
curl "https://api.telegram.org/bot<NEW_BOT_TOKEN>/getWebhookInfo"
```

---

### Шаг 5: Проверка

#### Проверьте, что бот работает:

```bash
curl "https://api.telegram.org/bot<NEW_BOT_TOKEN>/getMe"
```

Должен вернуть информацию о вашем боте.

#### Проверьте приложение:

1. Откройте https://trenki.app
2. Попробуйте войти через Telegram
3. Проверьте, что все функции работают

---

## 📋 Чек-лист безопасности:

- [ ] Новый Telegram Bot Token получен и сохранен
- [ ] Новый Kinescope API Key получен и сохранен  
- [ ] `.env.local` обновлен локально
- [ ] `.env` обновлен на сервере
- [ ] Vercel Environment Variables обновлены
- [ ] Приложение перезапущено на сервере
- [ ] GitHub репозиторий обновлен (force push выполнен)
- [ ] Webhook обновлен с новым токеном
- [ ] Приложение протестировано и работает
- [ ] Старые токены больше не найдены на GitHub (проверено поиском)

---

## 🛡️ Как избежать в будущем:

### 1. Добавьте pre-commit hook

Создайте файл `.git/hooks/pre-commit`:

```bash
#!/bin/bash

# Проверка на утечку токенов
if git diff --cached | grep -qiE '[0-9]{10}:AA[A-Za-z0-9_-]{33}'; then
  echo "❌ ОШИБКА: Найден Telegram BOT_TOKEN в коммите!"
  echo "Удалите токен перед коммитом."
  exit 1
fi

if git diff --cached | grep -qiE 'BOT_TOKEN.*=.*[0-9]{10}:'; then
  echo "❌ ОШИБКА: Найдено значение BOT_TOKEN в коммите!"
  echo "Используйте переменные окружения."
  exit 1
fi

exit 0
```

Сделайте его исполняемым:
```bash
chmod +x .git/hooks/pre-commit
```

### 2. Проверьте .gitignore

Убедитесь, что в `.gitignore` есть:
```
.env*
!.env.example
*.local
.DS_Store
```

### 3. Используйте .env.example

Создайте `.env.example` с примерами (БЕЗ реальных значений):
```env
BOT_TOKEN="your_bot_token_here"
KINESCOPE_API_KEY="your_kinescope_key_here"
DATABASE_URL="your_database_url_here"
```

---

## ❓ Вопросы и помощь

Если что-то не работает после восстановления:

1. Проверьте логи сервера: `pm2 logs` или `journalctl -u trenki -f`
2. Проверьте переменные окружения: `printenv | grep BOT_TOKEN`
3. Убедитесь, что новые токены действительны

---

**Дата создания:** 22 декабря 2025  
**Статус:** Git история очищена, ожидается force push на GitHub и обновление токенов
