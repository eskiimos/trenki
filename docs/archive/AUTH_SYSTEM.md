# Система авторизации и запоминания пользователя

## Обзор

Реализована полноценная система авторизации, которая запоминает пользователя и устройство, чтобы не требовать повторного входа при каждом запуске приложения.

## Возможности

✅ **Автоматическое запоминание пользователя** - после первой регистрации/входа
✅ **Сохранение данных в localStorage** - работает даже после закрытия браузера
✅ **Уникальный ID устройства** - для отслеживания устройства пользователя
✅ **Срок действия сессии** - 30 дней (настраивается)
✅ **Кнопка выхода** - для ручного выхода из аккаунта
✅ **Dev-режим** - автоматический тестовый пользователь для разработки
✅ **Интеграция с Telegram WebApp** - приоритет данным из Telegram

## Архитектура

### 1. Библиотека авторизации (`src/lib/auth.ts`)

Централизованная библиотека для работы с авторизацией:

```typescript
// Основные функции
saveAuth(authData)        // Сохранить данные авторизации
getAuth()                 // Получить сохранённые данные
clearAuth()               // Выйти (очистить данные)
isAuthenticated()         // Проверить, авторизован ли пользователь
getTelegramId()           // Получить Telegram ID (из WebApp или localStorage)
getUserData()             // Получить полные данные пользователя
generateDeviceId()        // Сгенерировать уникальный ID устройства
updateLastLogin()         // Обновить время последнего входа
```

### 2. Хук useTelegram (`src/hooks/useTelegram.ts`)

Обновлён для использования системы авторизации:

```typescript
const { user, webApp, isTelegramApp, platform } = useTelegram();

// user - объект пользователя (из Telegram или localStorage)
// webApp - объект Telegram WebApp API
// isTelegramApp - true, если открыто в Telegram Mini App
// platform - платформа (ios, android, web, etc.)
```

### 3. Onboarding (`src/components/Onboarding.tsx`)

После успешной регистрации автоматически сохраняет данные:

```typescript
// После регистрации
saveAuth({
  telegramId,
  firstName,
  lastName,
  username
});
```

### 4. OnboardingWrapper (`src/components/OnboardingWrapper.tsx`)

Проверяет авторизацию при загрузке:

```typescript
if (isAuthenticated()) {
  // Пропускаем онбординг, пользователь уже залогинен
  setShowOnboarding(false);
}
```

### 5. Страница профиля (`src/app/profile/page.tsx`)

Добавлена кнопка "Выйти" для ручного выхода:

```typescript
const handleLogout = () => {
  clearAuth();
  router.push('/');
  router.refresh();
};
```

## Данные, которые сохраняются

```typescript
interface AuthData {
  telegramId: string;      // ID пользователя в Telegram
  firstName?: string;      // Имя
  lastName?: string;       // Фамилия
  username?: string;       // Username в Telegram
  deviceId: string;        // Уникальный ID устройства
  lastLogin: string;       // Дата/время последнего входа (ISO 8601)
}
```

## Хранилище

Данные сохраняются в `localStorage` браузера:

- `trenki_auth` - данные авторизации пользователя
- `trenki_device_id` - уникальный ID устройства
- `dev_telegram_id` - тестовый ID для dev-режима

## Срок действия

По умолчанию сессия действительна **30 дней**. После этого:
- Данные автоматически удаляются
- Пользователь видит онбординг снова

Изменить срок можно в `src/lib/auth.ts`:

```typescript
if (daysSinceLogin > 30) {  // <-- изменить это число
  clearAuth();
  return null;
}
```

## Приоритет источников данных

1. **Telegram WebApp API** (если открыто в Telegram Mini App)
2. **Сохранённые данные** (`localStorage`)
3. **Dev-режим** (только в development)

## Использование

### Сохранить авторизацию после входа/регистрации

```typescript
import { saveAuth } from '@/lib/auth';

// После успешного входа/регистрации
saveAuth({
  telegramId: '123456789',
  firstName: 'Иван',
  lastName: 'Иванов',
  username: 'ivan_user'
});
```

### Проверить, авторизован ли пользователь

```typescript
import { isAuthenticated } from '@/lib/auth';

if (isAuthenticated()) {
  // Пользователь залогинен
} else {
  // Показать форму входа
}
```

### Получить данные пользователя

```typescript
import { getAuth } from '@/lib/auth';

const auth = getAuth();
if (auth) {
  console.log(auth.firstName, auth.lastName);
}
```

### Выйти из аккаунта

```typescript
import { clearAuth } from '@/lib/auth';

clearAuth(); // Удаляет все данные авторизации
```

## Тестирование

### 1. Тест авторизации

1. Откройте приложение
2. Пройдите онбординг
3. Закройте браузер
4. Откройте снова → Должны попасть сразу на главную (без онбординга)

### 2. Тест выхода

1. Перейдите в профиль
2. Нажмите кнопку "🚪 Выйти"
3. Перезагрузите страницу → Должен показаться онбординг

### 3. Тест dev-режима

1. Очистите localStorage: `localStorage.clear()`
2. Перезагрузите страницу
3. Должен создаться новый тестовый пользователь

### 4. Проверка в консоли

```javascript
// Посмотреть сохранённые данные
console.log(localStorage.getItem('trenki_auth'));

// Посмотреть ID устройства
console.log(localStorage.getItem('trenki_device_id'));

// Очистить всё
localStorage.clear();
```

## Безопасность

### Текущий уровень
- ⚠️ Данные хранятся в `localStorage` (не зашифрованы)
- ⚠️ Нет проверки токенов на сервере
- ⚠️ Можно подделать данные через DevTools

### Рекомендации для production

1. **Использовать JWT токены** вместо прямого хранения данных
2. **Валидация на сервере** - проверять токен при каждом запросе
3. **HttpOnly cookies** для более безопасного хранения
4. **Refresh tokens** для обновления сессии
5. **HTTPS обязательно** в production

### Пример улучшения (будущее)

```typescript
// Вместо хранения telegramId напрямую
localStorage.setItem('trenki_token', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...');

// И проверка на сервере
const isValid = await verifyToken(token);
```

## Отладка

### Логи в консоли

Ищите сообщения с префиксами:
- `useTelegram:` - логи хука
- `Auth saved:` - данные сохранены
- `Auth loaded:` - данные загружены
- `Auth expired` - сессия истекла
- `Auth cleared` - выход выполнен

### Команды для отладки

```javascript
// В консоли браузера

// Посмотреть текущую авторизацию
JSON.parse(localStorage.getItem('trenki_auth'))

// Вручную установить срок истечения (для теста)
let auth = JSON.parse(localStorage.getItem('trenki_auth'))
auth.lastLogin = '2020-01-01T00:00:00.000Z' // старая дата
localStorage.setItem('trenki_auth', JSON.stringify(auth))
location.reload() // Должен показать онбординг

// Сбросить всё
localStorage.clear()
location.reload()
```

## Roadmap

Планы по улучшению:

- [ ] JWT токены вместо прямого хранения
- [ ] Серверная валидация токенов
- [ ] HttpOnly cookies для безопасности
- [ ] Refresh tokens (автообновление сессии)
- [ ] Логирование событий входа/выхода в БД
- [ ] Multi-device поддержка (список устройств пользователя)
- [ ] Уведомления о входе с нового устройства
- [ ] Биометрическая аутентификация (Face ID, Touch ID)

## Поддержка

При возникновении проблем проверьте:

1. ✅ `localStorage` доступен в браузере
2. ✅ Данные не блокируются политикой cookies
3. ✅ Браузер не в режиме инкогнито
4. ✅ Нет ошибок в консоли браузера
