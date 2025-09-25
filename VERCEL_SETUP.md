# Настройка проекта на Vercel

## Переменные окружения

Для правильной работы приложения на Vercel, необходимо настроить следующие переменные окружения:

1. `DATABASE_URL` - URL для подключения к базе данных Prisma Cloud:
```
postgres://2f72b32ec43ba88878cada75ae8272ca19fffeafb7ec1102337ee6736f8d19a0:sk_KNbXiVixCXA0b00D4ZZnZ@db.prisma.io:5432/postgres?sslmode=require
```

2. `NEXT_PUBLIC_BUILDER_API_KEY` - API ключ для Builder.io:
```
d7d73318ca8e47c39e23f73d5928f7cd
```

3. `BOT_TOKEN` - токен для Telegram бота:
```
8124848980:AAFEzFLBJhE9dOyDoxzKA7Zse4T_Hr4q9xU
```

4. `WEB_APP_URL` - URL для Telegram Mini App:
```
https://trenki-mvp.vercel.app
```

## Настройка миграций Prisma

В настройках проекта на Vercel добавлен скрипт `postbuild`, который будет выполнять миграции Prisma после каждой сборки:

```json
"postbuild": "prisma migrate deploy"
```

Это обеспечивает автоматическое применение всех миграций базы данных после деплоя.

## Дополнительные команды для работы с Prisma

Для ручного управления миграциями Prisma используйте следующие команды:

1. Создание новой миграции:
```bash
npx prisma migrate dev --name <название_миграции>
```

2. Применение миграций в производственной среде:
```bash
npx prisma migrate deploy
```

3. Проверка статуса миграций:
```bash
npx prisma migrate status
```

4. Сброс базы данных (только для разработки):
```bash
npx prisma migrate reset
```

## Проверка соединения с базой данных

Для проверки, что соединение с базой данных Prisma Cloud работает корректно, можно создать простой API endpoint, который выполняет простой запрос к базе данных и возвращает результат.

```typescript
// pages/api/test-db.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';

export default async function handler(
  req: NextApiRequest, 
  res: NextApiResponse
) {
  try {
    const usersCount = await prisma.user.count();
    return res.status(200).json({ 
      success: true, 
      message: 'Database connection successful', 
      usersCount 
    });
  } catch (error) {
    console.error('Database connection error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Database connection failed', 
      error: String(error) 
    });
  }
}
```