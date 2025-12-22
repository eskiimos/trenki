# ✅ Чек-лист: Вход через Telegram на Production

## Проверка перед деплоем

### 1. Локальные файлы ✅

- [x] `.env.local` содержит:
  - `BOT_TOKEN="your_bot_token_from_botfather"  # ⚠️ Получите у @BotFather`
  - `NEXT_PUBLIC_BOT_USERNAME="trenkibot"`
- [x] Компонент `TelegramLogin.tsx` корректно работает в production
- [x] API endpoint `/api/auth/telegram/route.ts` проверяет подпись
- [x] Страница `/login` правильно обрабатывает авторизацию
- [x] `OnboardingWrapper` пропускает `/login` и `/onboarding`

### 2. Настройка Vercel Environment Variables 🔧

**ВАЖНО!** Нужно добавить переменные окружения в Vercel:

#### Шаги:

1. Откройте [Vercel Dashboard](https://vercel.com/dashboard)
2. Выберите проект `trenki`
3. Перейдите в **Settings** → **Environment Variables**
4. Добавьте следующие переменные:

| Name | Value | Environments |
|------|-------|--------------|
| `DATABASE_URL` | `prisma+postgres://accelerate.prisma-data.net/?api_key=...` | Production, Preview, Development |
| `KINESCOPE_API_KEY` | `your_kinescope_api_key` | Production, Preview, Development |
| `BOT_TOKEN` | `your_bot_token_from_botfather` | Production, Preview, Development |
- `BOT_TOKEN` - серверная переменная (без `NEXT_PUBLIC_`)
- `NEXT_PUBLIC_BOT_USERNAME` - публичная (с `NEXT_PUBLIC_`)

5. Нажмите **Save** для каждой переменной
6. **Redeploy** проект после добавления переменных

### 3. Настройка домена в BotFather 🤖

#### Шаги в Telegram:

1. Откройте [@BotFather](https://t.me/botfather)
2. Отправьте команду: `/setdomain`
3. Выберите бота: `@trenkibot`
4. Укажите домен: `trenki.vercel.app` (без https:// и путей!)
5. Дождитесь подтверждения от BotFather

#### Что должно быть:

```
You: /setdomain
BotFather: Choose a bot to set domain.

You: @trenkibot
BotFather: Send me the domain name...

You: trenki.vercel.app
BotFather: ✅ Success! Users will be able to log in from:
           trenki.vercel.app
```

### 4. Проверка деплоя 🚀

После деплоя на Vercel:

- [ ] Проект успешно задеплоился
- [ ] Нет ошибок в логах билда
- [ ] Environment Variables установлены
- [ ] Домен настроен в BotFather

### 5. Тестирование на production 🧪

1. **Откройте в браузере:**
   ```
   https://trenki.vercel.app/login
   ```

2. **Проверьте консоль разработчика (F12):**
   - Не должно быть ошибок "Bot domain invalid"
   - Должен загрузиться Telegram Login Widget (синяя кнопка)

3. **Нажмите "Log in via Telegram":**
   - Откроется окно Telegram
   - Запросит подтверждение входа
   - После подтверждения вернёт на сайт

4. **Проверьте перенаправление:**
   - Если профиль не заполнен → `/onboarding`
   - Если профиль заполнен → `/` (главная)

5. **Проверьте авторизацию:**
   - Закройте браузер
   - Откройте снова → должны быть авторизованы
   - Не показывается онбординг

### 6. Возможные проблемы и решения 🔧

#### Проблема: "Bot domain invalid"
**Решение:**
- Проверьте, настроен ли домен в BotFather
- Убедитесь, что указали домен без `https://`
- Подождите 1-2 минуты после настройки
- Очистите кеш браузера (Ctrl+Shift+R)

#### Проблема: Виджет не загружается
**Решение:**
- Проверьте консоль браузера на ошибки
- Убедитесь, что `NEXT_PUBLIC_BOT_USERNAME` установлен в Vercel
- Проверьте, что используется правильный username: `trenkibot`

#### Проблема: "Invalid signature"
**Решение:**
- Проверьте, что `BOT_TOKEN` правильный в Vercel
- Убедитесь, что токен не содержит лишних пробелов
- Redeploy после изменения переменных

#### Проблема: Перенаправление не работает
**Решение:**
- Проверьте, что профиль создаётся в БД
- Проверьте логи API: `/api/auth/telegram`
- Проверьте консоль браузера на ошибки

### 7. Команды для проверки 🛠️

#### Проверить deployment на Vercel:
```bash
vercel --prod
```

#### Проверить переменные окружения:
```bash
vercel env ls
```

#### Посмотреть логи:
```bash
vercel logs
```

#### Проверить бота через API:
```bash
curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getMe"
```

Должен вернуть:
```json
{
  "ok": true,
  "result": {
    "id": 8124848980,
    "is_bot": true,
    "first_name": "Треньки",
    "username": "trenkibot",
    ...
  }
}
```

## Финальная проверка ✅

После выполнения всех шагов:

- [ ] Vercel Environment Variables установлены
- [ ] Домен настроен в BotFather
- [ ] Проект задеплоен на production
- [ ] Страница `/login` открывается
- [ ] Telegram Login Widget загружается
- [ ] Вход через Telegram работает
- [ ] Авторизация сохраняется
- [ ] Перенаправления работают корректно

## 🎉 Готово!

Если все пункты выполнены, вход через Telegram работает на production!

### Полезные ссылки:

- Production: https://trenki.vercel.app
- Login: https://trenki.vercel.app/login
- Vercel Dashboard: https://vercel.com/dashboard
- BotFather: https://t.me/botfather
- Telegram Bot API: https://core.telegram.org/bots/api

---

**Последнее обновление:** 17 октября 2025 г.
