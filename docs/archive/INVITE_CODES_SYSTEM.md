# 🎫 Система инвайт-кодов для закрытого бета-тестирования

## Описание

Реализована система инвайт-кодов для ограничения доступа к приложению во время бета-тестирования. Коды имеют формат **XXX-XXX** (например, `ABC-123`).

## Функциональность

### ✨ Основные возможности

1. **Стартовая страница с вводом кода** (`/invite`)
   - Красивый UI с градиентом
   - Автоформатирование кода
   - Поддержка вставки из буфера обмена
   - Валидация в реальном времени

2. **Валидация кодов через API**
   - Проверка формата кода
   - Проверка активности и срока действия
   - Проверка лимита использований
   - Сохранение в cookies для backend

3. **Интеграция с авторизацией**
   - Проверка кода при регистрации через Telegram
   - Увеличение счётчика использований
   - Сохранение кода в профиле пользователя

4. **Ачивка "Первопроходец"**
   - Автоматически выдаётся всем новым пользователям
   - Легендарная редкость (legendary)
   - Сохраняется в таблице `user_achievements`

5. **Middleware защита**
   - Редирект на `/invite` при отсутствии кода
   - Защита всех маршрутов кроме публичных

## Структура базы данных

### Таблица `invite_codes`

```prisma
model InviteCode {
  id          String    @id @default(cuid())
  code        String    @unique // Формат: XXX-XXX
  maxUses     Int       @default(1) // Сколько раз можно использовать
  usedCount   Int       @default(0) // Сколько раз использовали
  isActive    Boolean   @default(true) // Активен ли код
  createdAt   DateTime  @default(now())
  expiresAt   DateTime? // Дата истечения (опционально)
  description String?   // Описание
}
```

### Таблица `achievements`

```prisma
model Achievement {
  id          String   @id @default(cuid())
  key         String   @unique // "pioneer"
  name        String   // "Первопроходец"
  description String?
  icon        String?  // "🚀"
  rarity      String   @default("common") // legendary
}
```

### Таблица `user_achievements`

```prisma
model UserAchievement {
  id            String   @id @default(cuid())
  userId        String
  achievementId String
  earnedAt      DateTime @default(now())
}
```

## Использование

### 1. Миграция базы данных

Применяем изменения схемы:

```bash
npx prisma migrate dev --name add_invite_codes_and_achievements
```

### 2. Генерация инвайт-кодов

Запускаем скрипт для генерации кодов:

```bash
# Сгенерировать 25 кодов (по умолчанию)
node scripts/generate-invite-codes.js

# Сгенерировать определённое количество
node scripts/generate-invite-codes.js 50

# С описанием
node scripts/generate-invite-codes.js 25 "Бета-тест декабрь 2025"
```

Скрипт:
- ✅ Генерирует уникальные коды формата XXX-XXX
- ✅ Сохраняет коды в БД
- ✅ Выводит список в консоль
- ✅ Сохраняет коды в файл `invite-codes-YYYY-MM-DD.txt`

### 3. Распространение кодов

Раздайте сгенерированные коды тестерам. Каждый код можно использовать 1 раз (настраивается в скрипте через `maxUses`).

### 4. Процесс регистрации пользователя

1. Пользователь заходит на сайт → редирект на `/invite`
2. Вводит код формата XXX-XXX
3. Код валидируется через API
4. При успехе → сохраняется в cookies → редирект на `/login`
5. Пользователь логинится через Telegram
6. Backend проверяет код, создаёт пользователя, выдаёт ачивку
7. Счётчик использований кода увеличивается

## API эндпоинты

### POST `/api/invite/validate`

Валидирует инвайт-код.

**Request:**
```json
{
  "code": "ABC-123"
}
```

**Response (успех):**
```json
{
  "valid": true,
  "code": "ABC-123",
  "description": "Закрытое бета-тестирование"
}
```

**Response (ошибка):**
```json
{
  "valid": false,
  "error": "Код не найден"
}
```

### GET `/api/invite/validate?code=ABC-123`

Проверяет валидность кода без увеличения счётчика.

**Response:**
```json
{
  "valid": true
}
```

## Администрирование

### Просмотр использования кодов

```sql
-- Все коды с использованием
SELECT code, usedCount, maxUses, isActive, createdAt 
FROM invite_codes 
ORDER BY createdAt DESC;

-- Оставшиеся доступные коды
SELECT code, (maxUses - usedCount) as remaining
FROM invite_codes 
WHERE isActive = true 
  AND usedCount < maxUses;
```

### Деактивация кода

```sql
UPDATE invite_codes 
SET isActive = false 
WHERE code = 'ABC-123';
```

### Просмотр пользователей с ачивкой

```sql
SELECT u.firstName, u.username, ua.earnedAt
FROM user_achievements ua
JOIN users u ON ua.userId = u.id
JOIN achievements a ON ua.achievementId = a.id
WHERE a.key = 'pioneer'
ORDER BY ua.earnedAt DESC;
```

## Настройки

### Отключение системы инвайт-кодов

Если нужно открыть доступ всем:

1. Закомментируйте проверку в [src/middleware.ts](src/middleware.ts#L46-L51):
```typescript
// Закомментируйте эти строки
// if (!inviteCode && !telegramId && pathname !== '/invite') {
//   const inviteUrl = new URL('/invite', request.url);
//   return NextResponse.redirect(inviteUrl);
// }
```

2. Закомментируйте проверку в [src/app/api/auth/telegram/route.ts](src/app/api/auth/telegram/route.ts#L59-L94):
```typescript
// Закомментируйте блок проверки инвайт-кода
```

### Изменение формата кода

В [scripts/generate-invite-codes.js](scripts/generate-invite-codes.js#L5) измените логику генерации:

```javascript
function generateCode() {
  // Изменить длину, символы, формат
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  // ...
}
```

## Безопасность

✅ **Что реализовано:**
- Валидация формата кода на клиенте и сервере
- Проверка срока действия
- Ограничение количества использований
- Защита от повторного использования
- Middleware проверка на всех маршрутах
- Сохранение кода в профиле пользователя

⚠️ **Рекомендации:**
- Не публикуйте коды в открытых источниках
- Периодически проверяйте использование кодов
- Устанавливайте `expiresAt` для временного доступа
- Используйте разные коды для разных групп тестеров

## Troubleshooting

### Ошибка "Требуется инвайт-код"

Убедитесь что:
1. Код был введён на `/invite` странице
2. Cookie `inviteCode` установлена (проверьте в DevTools)
3. Код валиден и активен в БД

### Ачивка не выдаётся

Проверьте:
1. Существует ли ачивка с `key='pioneer'` в БД
2. Логи сервера при регистрации
3. Не дублируется ли запись в `user_achievements`

### Коды не генерируются

Убедитесь что:
1. База данных доступна
2. Prisma Client сгенерирован: `npx prisma generate`
3. Нет конфликтов с существующими кодами

## Файлы системы

- 📄 [prisma/schema.prisma](prisma/schema.prisma) - Схема БД
- 📄 [src/app/invite/page.tsx](src/app/invite/page.tsx) - Страница ввода кода
- 📄 [src/app/api/invite/validate/route.ts](src/app/api/invite/validate/route.ts) - API валидации
- 📄 [src/app/api/auth/telegram/route.ts](src/app/api/auth/telegram/route.ts) - Обработка регистрации
- 📄 [src/middleware.ts](src/middleware.ts) - Middleware защита
- 📄 [scripts/generate-invite-codes.js](scripts/generate-invite-codes.js) - Генератор кодов

## Дальнейшее развитие

Возможные улучшения:
- 🎯 Админ-панель для управления кодами
- 📊 Статистика использования кодов
- 🎁 Разные типы кодов с разными привилегиями
- 🔗 Реферальная система
- 📧 Email-нотификации об использовании
- ⏰ Автоматическая деактивация истёкших кодов
