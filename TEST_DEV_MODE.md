# Тестирование DEV MODE для training/assessment

## Проблема (исправлена)
При нажатии "Вперёд" на странице `/training/assessment` на dev сервере появлялась ошибка "пользователь не авторизован".

## Решение
Добавлен автоматический DEV MODE, который:
1. Создаёт тестового пользователя в `localStorage`
2. Автоматически создаёт пользователя в БД при первом API запросе
3. Добавляет подробное логирование для отладки

## Тестирование

### 1. Запустите dev сервер
```bash
npm run dev
```

### 2. Откройте браузер
Перейдите на http://localhost:3001

### 3. Откройте консоль разработчика
Нажмите F12 или Cmd+Option+I (Mac)

### 4. Перейдите на страницу assessment
http://localhost:3001/training/assessment

### 5. Проверьте логи в консоли
Вы должны увидеть:
```
🔧 DEV MODE: Created new test user ID: dev_XXXXXXXXXX
или
🔧 DEV MODE: Using existing test user ID: dev_XXXXXXXXXX
```

### 6. Заполните форму
- Выберите "Когда последний раз тренировались?" (любой вариант)
- Выберите "Уровень энергии" (двигайте слайдер)

### 7. Нажмите "Вперёд"

### 8. Проверьте логи
Вы должны увидеть последовательность:
```
🎯 Assessment submit - User: {id: "dev_XXXXX", ...}
📤 Sending assessment: {userId: "dev_XXXXX", ...}
🔧 DEV MODE: Checking user in DB: dev_XXXXX
🔧 DEV MODE: Creating new dev user in DB (первый раз)
✅ DEV MODE: Created user: {...}
📥 Assessment response: {success: true, ...}
📤 Generating workout: {userId: "dev_XXXXX", assessmentId: "..."}
🔧 DEV MODE: User exists in DB (второй API вызов)
📥 Generate response: {success: true, ...}
✅ Workout generated, redirecting...
```

### 9. Должен быть редирект
Страница должна автоматически перейти на `/training/workout`

## Если что-то пошло не так

### Пользователь не создался
1. Проверьте консоль на ошибки
2. Проверьте, что БД доступна
3. Попробуйте сбросить dev пользователя:
```javascript
localStorage.removeItem('dev_telegram_id');
location.reload();
```

### Ошибка в API
1. Проверьте логи сервера в терминале
2. Убедитесь, что Prisma схема актуальна:
```bash
npx prisma generate
```

### Нет редиректа
1. Проверьте логи в консоли
2. Посмотрите на ответ от `/api/training/generate`
3. Проверьте, что в БД есть модули тренировок

## Сброс для нового теста
```javascript
// В консоли браузера
localStorage.removeItem('dev_telegram_id');
location.reload();
```

## Важно
- DEV MODE работает ТОЛЬКО в development (NODE_ENV === 'development')
- В production потребуется настоящий Telegram WebApp
- Все dev пользователи имеют ID формата `dev_TIMESTAMP`
