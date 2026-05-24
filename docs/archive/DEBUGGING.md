# 🐛 Диагностика ошибки сохранения профиля на продакшене

## Шаги диагностики:

### 1. Проверить логи в браузере
```javascript
// Откройте DevTools (F12) в мини-приложении и проверьте:
// - Console для ошибок JavaScript
// - Network для статуса запросов к API
```

### 2. Проверить тестовый API эндпоинт
Откройте в мини-приложении: `https://trenki.vercel.app/api/test-db`
Это должно показать статус подключения к базе данных.

### 3. Проверить данные пользователя в консоли
```javascript
// В DevTools Console выполните:
console.log('Telegram WebApp:', window.Telegram?.WebApp);
console.log('User data:', window.Telegram?.WebApp?.initDataUnsafe?.user);
```

### 4. Тестовый POST запрос
```javascript
// В DevTools Console попробуйте ручной запрос:
fetch('/api/profile', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    telegramId: '123456789',
    firstName: 'Test',
    lastName: 'User',
    profile: { position: 'CENTER' }
  })
}).then(r => r.json()).then(console.log).catch(console.error);
```

## Возможные решения:

### Если проблема с Telegram данными:
- Добавить fallback для получения telegramId
- Использовать initData вместо user объекта

### Если проблема с CORS/Network:
- Проверить настройки домена в Telegram Bot
- Добавить CORS headers в API

### Если проблема с базой данных:
- Проверить статус Prisma Cloud
- Выполнить миграции на продакшене

## Логи для разработчика:
Все детальные логи теперь выводятся в консоль с префиксом `=== PROFILE SAVE DEBUG ===`