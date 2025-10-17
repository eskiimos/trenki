# 🔐 Вход через Telegram

## Обзор

Реализована система входа через Telegram с использованием официального Telegram Login Widget. Это безопасный, быстрый и удобный способ авторизации без паролей.

## 🎯 Как это работает

### Для пользователей

1. **Открывают страницу входа** (`/login`)
2. **Видят кнопку "Login with Telegram"**
3. **Нажимают кнопку** → открывается Telegram
4. **Подтверждают вход** в Telegram
5. **Автоматически авторизуются** в приложении ✅

### Технически

1. Telegram Login Widget загружается на страницу
2. Пользователь авторизуется через Telegram
3. Telegram отправляет подписанные данные пользователя
4. Сервер проверяет подпись (для безопасности)
5. Создаётся/обновляется пользователь в БД
6. Данные сохраняются в localStorage (автологин)

## 📁 Структура

### Компоненты

**`src/components/TelegramLogin.tsx`**
- React-компонент Telegram Login Widget
- Автоматическая загрузка скрипта виджета
- Callback для обработки авторизации

**`src/app/login/page.tsx`**
- Страница входа
- Красивый UI с логотипом
- Обработка авторизации
- Перенаправление после входа

**`src/app/onboarding/page.tsx`**
- Страница заполнения профиля
- Для пользователей, вошедших через Telegram
- Сбор возраста, пола, имени/фамилии

### API

**`src/app/api/auth/telegram/route.ts`**
- POST эндпоинт для обработки авторизации
- Проверка подписи от Telegram
- Создание/обновление пользователя в БД
- Проверка полноты профиля

## 🔒 Безопасность

### Проверка подписи

Каждый запрос от Telegram содержит hash-подпись. Сервер проверяет её:

```typescript
function verifyTelegramAuth(data, botToken) {
  // 1. Извлекаем hash
  const { hash, ...authData } = data;
  
  // 2. Создаём строку для проверки
  const dataCheckString = Object.keys(authData)
    .sort()
    .map(key => `${key}=${authData[key]}`)
    .join('\n');
  
  // 3. Создаём secret key из токена бота
  const secretKey = crypto
    .createHash('sha256')
    .update(botToken)
    .digest();
  
  // 4. Вычисляем hash
  const computedHash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');
  
  // 5. Сравниваем
  return computedHash === hash;
}
```

Если подпись неверная → запрос отклоняется (403).

### Проверка актуальности

Данные не должны быть старше 24 часов:

```typescript
const currentTime = Math.floor(Date.now() / 1000);
if (currentTime - data.auth_date > 86400) {
  return { error: 'Данные устарели' };
}
```

### Что проверяется

- ✅ Наличие всех обязательных полей
- ✅ Корректность подписи (hash)
- ✅ Актуальность данных (не старше 24ч)
- ✅ Валидность токена бота

## 📊 Данные от Telegram

После авторизации Telegram предоставляет:

```typescript
interface TelegramAuthData {
  id: number;           // Уникальный ID пользователя
  first_name: string;   // Имя
  last_name?: string;   // Фамилия (опционально)
  username?: string;    // @username (опционально)
  photo_url?: string;   // URL аватара (опционально)
  auth_date: number;    // Время авторизации (Unix timestamp)
  hash: string;         // Подпись для проверки
}
```

## 🎨 UI/UX

### Страница входа

- Логотип "ТРЕНЬКИ"
- Описание преимуществ
- Кнопка Telegram Login
- Информация о безопасности
- Ссылки на условия использования

### Состояния

1. **Загрузка виджета** - "Загрузка виджета Telegram..."
2. **Готов к входу** - синяя кнопка Telegram
3. **Авторизация** - спиннер "Авторизация..."
4. **Ошибка** - красное уведомление

## 🔄 Сценарии

### 1️⃣ Новый пользователь

```
1. Открывает /login
2. Нажимает "Login with Telegram"
3. Подтверждает в Telegram
4. → Перенаправление на /onboarding (заполнить профиль)
5. Заполняет возраст, пол, имя/фамилию
6. → Перенаправление на / (главная)
```

### 2️⃣ Существующий пользователь (профиль не заполнен)

```
1. Открывает /login
2. Нажимает "Login with Telegram"
3. Подтверждает в Telegram
4. → Перенаправление на /onboarding (дозаполнить профиль)
5. Заполняет недостающие данные
6. → Перенаправление на / (главная)
```

### 3️⃣ Существующий пользователь (профиль заполнен)

```
1. Открывает /login
2. Нажимает "Login with Telegram"
3. Подтверждает в Telegram
4. → Перенаправление на / (главная) ✅
```

### 4️⃣ Пользователь с сохранённой авторизацией

```
1. Открывает /
2. → Сразу попадает на главную (без /login) ✅
```

## ⚙️ Настройка

### 1. Переменные окружения

В `.env.local`:

```bash
# Токен вашего Telegram бота
BOT_TOKEN="your_bot_token_here"

# Username бота (без @)
NEXT_PUBLIC_BOT_USERNAME="your_bot_username"
```

### 2. Настройка бота

1. Создайте бота через [@BotFather](https://t.me/botfather)
2. Получите токен
3. Включите Login Widget:
   ```
   /setdomain
   your-domain.com
   ```

### 3. Важно!

- `BOT_TOKEN` - **серверная** переменная (не доступна в браузере)
- `NEXT_PUBLIC_BOT_USERNAME` - **публичная** (доступна в браузере)

## 🧪 Тестирование

### Локально

1. Убедитесь, что переменные окружения установлены
2. Запустите dev-сервер: `npm run dev`
3. Откройте `/login`
4. Нажмите кнопку Telegram Login
5. Подтвердите в Telegram

### В production

1. Установите domain в BotFather:
   ```
   /setdomain
   your-production-domain.com
   ```
2. Деплойте на Vercel
3. Откройте `https://your-domain.com/login`

### Отладка

**Включить подробные логи:**

В `src/app/api/auth/telegram/route.ts` уже есть логи:

```typescript
console.log('Telegram auth request:', data);
console.log('Telegram auth signature verified ✓');
console.log('Creating new user:', telegramId);
```

**Проверить подпись вручную:**

```bash
# В консоли браузера
console.log(authData);
```

## ❗ Частые проблемы

### Виджет не загружается

**Причина:** Блокировщик рекламы или CSP

**Решение:**
- Отключите блокировщик рекламы
- Проверьте Content Security Policy
- Добавьте в `next.config.ts`:
  ```typescript
  async headers() {
    return [{
      source: '/(.*)',
      headers: [{
        key: 'Content-Security-Policy',
        value: "script-src 'self' 'unsafe-inline' telegram.org;"
      }]
    }];
  }
  ```

### Ошибка "Invalid hash"

**Причина:** Неправильный BOT_TOKEN или данные были изменены

**Решение:**
- Проверьте, что `BOT_TOKEN` правильный
- Перезапустите сервер после изменения `.env.local`

### "Data expired"

**Причина:** Данные старше 24 часов

**Решение:**
- Авторизуйтесь заново
- Проверьте системное время

### Redirect loop

**Причина:** Неправильная логика редиректов в `OnboardingWrapper`

**Решение:**
- Проверьте логи в консоли
- Убедитесь, что профиль заполнен
- Очистите localStorage: `localStorage.clear()`

## 📚 Ресурсы

- [Telegram Login Widget документация](https://core.telegram.org/widgets/login)
- [BotFather](https://t.me/botfather)
- [Telegram Bot API](https://core.telegram.org/bots/api)

## 🎁 Преимущества

✅ **Безопасно** - официальный виджет от Telegram  
✅ **Быстро** - вход в один клик  
✅ **Без паролей** - не нужно запоминать  
✅ **Удобно** - работает на всех платформах  
✅ **Доверие** - пользователи знают Telegram  
✅ **Без регистрации** - используется существующий аккаунт  

## 🔮 Будущие улучшения

- [ ] QR-код для входа
- [ ] Биометрическая аутентификация
- [ ] Multi-device management
- [ ] Session management (список активных сессий)
- [ ] Two-factor authentication (опционально)
- [ ] Social login (VK, Google) как альтернатива
