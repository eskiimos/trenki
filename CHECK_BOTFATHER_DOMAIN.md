# 🔍 Проверка и исправление домена в BotFather

## Проблема
Ошибка **"Bot domain invalid"** при попытке использовать Telegram Login Widget.

## Причина
Домен, с которого открывается страница с виджетом, не настроен в BotFather как разрешённый домен для Web Login.

## ✅ Что уже сделано
1. ✅ Webhook обновлён на `trenki.vercel.app`
2. ✅ Код обновлён - все ссылки на `trenki.vercel.app`

## 🔧 Что нужно сделать ПРЯМО СЕЙЧАС

### 1. Открыть BotFather в Telegram

1. Открой Telegram
2. Найди бота **@BotFather**
3. Отправь команду `/mybots`
4. Выбери бота **@trenkibot**

### 2. Проверить настройки домена

5. Нажми **Bot Settings**
6. Нажми **Domain**
7. Проверь, какой домен там указан

### 3. Если домен НЕ `trenki.vercel.app` - исправить

**Вариант А: Заменить домен**
- Отправь новый домен: `trenki.vercel.app`
- BotFather заменит старый домен на новый

**Вариант Б: Добавить второй домен** (если нужны оба)
- Текущий список доменов ты увидишь в ответе BotFather
- Чтобы добавить второй домен, отправь оба через запятую:
  ```
  trenki.vercel.app, trenki-mvp.vercel.app
  ```

### 4. Проверить результат

После настройки домена BotFather должен ответить:
```
Success! Web login is now available on trenki.vercel.app
```

Или для нескольких доменов:
```
Success! Web login is now available on trenki.vercel.app and trenki-mvp.vercel.app
```

## 🧪 Тестирование после настройки

1. **Очисти кэш браузера**: `Ctrl+Shift+R` (Windows/Linux) или `Cmd+Shift+R` (Mac)
2. Или открой в **режиме инкогнито**
3. Открой: https://trenki.vercel.app/login
4. Должна появиться синяя кнопка **"Login with Telegram"**
5. При клике на кнопку НЕ должно быть ошибки "Bot domain invalid"

## ❓ Частые вопросы

**Q: У меня в BotFather уже `trenki.vercel.app`, но всё равно ошибка**
- A: Очисти кэш браузера или попробуй в режиме инкогнито. Vercel мог закешировать старую версию.

**Q: Можно ли иметь два домена одновременно?**
- A: Да! Отправь их через запятую: `trenki.vercel.app, trenki-mvp.vercel.app`

**Q: Нужно ли настраивать webhook отдельно?**
- A: Webhook уже настроен. Это отдельная настройка от Domain для Web Login.

## 📸 Скриншот настройки

Путь в BotFather:
```
/mybots
 → @trenkibot
  → Bot Settings
   → Domain
    → Введи: trenki.vercel.app
```

## 🆘 Если не помогло

1. Покажи, что выводит BotFather после настройки домена
2. Проверь переменные окружения в Vercel:
   - `NEXT_PUBLIC_BOT_USERNAME=trenkibot`
   - `BOT_TOKEN=8124848980:AAFEzFLBJhE9dOyDoxzKA7Zse4T_Hr4q9xU`
3. Дождись нового deploy в Vercel (2-3 минуты после пуша)
