# План внедрения системы сохранения тренировок

## Обзор
Система для хранения сгенерированных тренировок в БД с возможностью продолжить незавершенную тренировку.

## Изменения в базе данных ✅

### Обновленная схема Prisma

```prisma
// Сессия тренировки (сгенерированная тренировка)
model WorkoutSession {
  id                String                    @id @default(cuid())
  userId            String
  
  // Параметры генерации
  assessmentId      String?                   
  targetDuration    Int                       
  targetRPE         Int                       
  loadDirection     LoadDirection             
  
  // Статус выполнения
  status            WorkoutStatus             @default(PENDING)  // PENDING, IN_PROGRESS, COMPLETED, SKIPPED
  startedAt         DateTime?                 // когда начата
  completedAt       DateTime?                 // когда завершена
  actualDuration    Int?                      
  actualRPE         Int?                      
  
  // Прогресс
  currentVideoIndex Int                       @default(0) // индекс текущего видео
  totalVideos       Int                       @default(0) // общее кол-во видео
  
  createdAt         DateTime                  @default(now())
  updatedAt         DateTime                  @updatedAt
  
  videos            WorkoutSessionVideo[]

  @@index([userId, createdAt])
  @@index([userId, status])
}

// Связь тренировки с видео
model WorkoutSessionVideo {
  id                String                @id @default(cuid())
  sessionId         String
  videoId           String
  order             Int                   // порядок видео (0 = первое)
  completed         Boolean               @default(false)
  startedAt         DateTime?             
  completedAt       DateTime?             
  watchedDuration   Int?                  // сколько секунд просмотрено
  actualRPE         Int?                  
  
  session           WorkoutSession        @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  video             Video                 @relation(fields: [videoId], references: [id])

  @@unique([sessionId, videoId])
}
```

## Задачи для реализации

### 1. Миграция базы данных 🔄
```bash
# После завершения текущих изменений запустить:
npx prisma migrate dev --name add_workout_session_video
npx prisma generate
```

### 2. Обновить API генерации тренировок (`/api/training/generate`)

**Текущее поведение:** Возвращает временный ID тренировки  
**Новое поведение:** Сохраняет в БД и возвращает реальный ID

```typescript
// Создаём WorkoutSession в БД
const workoutSession = await prisma.workoutSession.create({
  data: {
    userId,
    assessmentId: assessment.id,
    targetDuration: assessment.availableTime,
    targetRPE: assessment.recommendedRPE,
    loadDirection: assessment.loadDirection,
    status: 'PENDING',
    totalVideos: selectedVideos.length,
    currentVideoIndex: 0,
    videos: {
      create: selectedVideos.map((video, index) => ({
        videoId: video.id,
        order: index,
        completed: false,
      })),
    },
  },
  include: {
    videos: {
      include: {
        video: {
          include: {
            trainer: true,
          },
        },
      },
      orderBy: { order: 'asc' },
    },
  },
});

return NextResponse.json({
  success: true,
  workout: {
    id: workoutSession.id, // реальный ID из БД
    // ... остальные поля
  },
});
```

### 3. Создать API для получения текущей тренировки

**Endpoint:** `GET /api/training/current?userId=xxx`  
**Возвращает:** Незавершенную тренировку пользователя (status = PENDING или IN_PROGRESS)

```typescript
// src/app/api/training/current/route.ts
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  const currentWorkout = await prisma.workoutSession.findFirst({
    where: {
      userId,
      status: { in: ['PENDING', 'IN_PROGRESS'] },
    },
    include: {
      videos: {
        include: {
          video: {
            include: { trainer: true },
          },
        },
        orderBy: { order: 'asc' },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ workout: currentWorkout });
}
```

### 4. Обновить страницу тренировки (`/training/workout`)

- Получать тренировку из БД по ID (из query параметра)
- Показывать прогресс (текущее видео / всего видео)
- Кнопка "Продолжить" вместо "Начать" если status = IN_PROGRESS

### 5. Обновить видеоплеер (`/video/[id]`)

**Добавить логику отслеживания:**
- При начале просмотра видео из тренировки:
  ```typescript
  // Обновляем статус тренировки на IN_PROGRESS
  // Обновляем startedAt для текущего видео
  await fetch('/api/training/update', {
    method: 'POST',
    body: JSON.stringify({
      sessionId,
      videoId,
      action: 'start',
    }),
  });
  ```

- При завершении видео:
  ```typescript
  // Отмечаем видео как выполненное
  // Увеличиваем currentVideoIndex
  // Если это последнее видео - меняем статус тренировки на COMPLETED
  await fetch('/api/training/update', {
    method: 'POST',
    body: JSON.stringify({
      sessionId,
      videoId,
      action: 'complete',
      watchedDuration,
      actualRPE,
    }),
  });
  ```

- Навигация между видео в тренировке:
  ```typescript
  // Кнопка "Следующее видео" → переход к следующему по order
  router.push(`/video/${nextVideoId}?fromWorkout=true&sessionId=${sessionId}`);
  ```

### 6. Создать API для обновления прогресса

**Endpoint:** `POST /api/training/update`

```typescript
// src/app/api/training/update/route.ts
export async function POST(request: NextRequest) {
  const { sessionId, videoId, action, watchedDuration, actualRPE } = await request.json();

  if (action === 'start') {
    // Обновляем статус тренировки на IN_PROGRESS
    await prisma.workoutSession.update({
      where: { id: sessionId },
      data: {
        status: 'IN_PROGRESS',
        startedAt: new Date(),
      },
    });

    // Отмечаем начало видео
    await prisma.workoutSessionVideo.updateMany({
      where: { sessionId, videoId },
      data: { startedAt: new Date() },
    });
  }

  if (action === 'complete') {
    // Отмечаем видео как завершенное
    await prisma.workoutSessionVideo.updateMany({
      where: { sessionId, videoId },
      data: {
        completed: true,
        completedAt: new Date(),
        watchedDuration,
        actualRPE,
      },
    });

    // Увеличиваем currentVideoIndex
    const session = await prisma.workoutSession.findUnique({
      where: { id: sessionId },
      include: { videos: true },
    });

    const nextIndex = session.currentVideoIndex + 1;

    // Если все видео завершены - завершаем тренировку
    if (nextIndex >= session.totalVideos) {
      await prisma.workoutSession.update({
        where: { id: sessionId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          currentVideoIndex: nextIndex,
        },
      });
    } else {
      await prisma.workoutSession.update({
        where: { id: sessionId },
        data: { currentVideoIndex: nextIndex },
      });
    }
  }

  return NextResponse.json({ success: true });
}
```

### 7. Добавить напоминание на главную страницу

**Компонент:** `<WorkoutReminder />` на главной странице

```typescript
// src/components/WorkoutReminder.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getTelegramId } from '@/lib/auth';

export default function WorkoutReminder() {
  const router = useRouter();
  const [workout, setWorkout] = useState(null);

  useEffect(() => {
    const fetchCurrentWorkout = async () => {
      const telegramId = getTelegramId();
      if (!telegramId) return;

      const response = await fetch(`/api/training/current?userId=${telegramId}`);
      const data = await response.json();
      
      if (data.workout) {
        setWorkout(data.workout);
      }
    };

    fetchCurrentWorkout();
  }, []);

  if (!workout) return null;

  const completedVideos = workout.videos.filter(v => v.completed).length;
  const totalVideos = workout.totalVideos;
  const progress = Math.round((completedVideos / totalVideos) * 100);

  return (
    <div className="bg-gradient-to-r from-orange-500 to-orange-600 p-4 rounded-lg shadow-lg mb-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-white font-bold text-lg">
            🔥 Незавершенная тренировка
          </h3>
          <p className="text-white/90 text-sm mt-1">
            Прогресс: {completedVideos}/{totalVideos} видео ({progress}%)
          </p>
        </div>
        <button
          onClick={() => router.push(`/training/workout?id=${workout.id}`)}
          className="bg-white text-orange-600 px-4 py-2 rounded-lg font-semibold hover:bg-orange-50"
        >
          Продолжить
        </button>
      </div>
    </div>
  );
}
```

**Добавить на главную:**
```typescript
// src/app/page.tsx
import WorkoutReminder from '@/components/WorkoutReminder';

export default function Home() {
  return (
    <div>
      <WorkoutReminder />
      {/* остальной контент */}
    </div>
  );
}
```

## Порядок внедрения

1. ✅ Обновить схему Prisma (уже сделано)
2. 🔄 Запустить миграцию базы данных
3. 🔄 Обновить `/api/training/generate` для сохранения в БД
4. 🔄 Создать `/api/training/current` для получения текущей тренировки
5. 🔄 Создать `/api/training/update` для обновления прогресса
6. 🔄 Обновить `/training/workout` для работы с реальными ID
7. 🔄 Обновить `/video/[id]` для отслеживания прогресса
8. 🔄 Создать компонент `WorkoutReminder`
9. 🔄 Добавить `WorkoutReminder` на главную страницу

## Дополнительные улучшения (опционально)

- **История тренировок:** Страница с историей всех завершенных тренировок
- **Статистика:** Среднее время тренировки, любимые типы модулей, прогресс RPE
- **Уведомления:** Push-уведомления о незавершенной тренировке через день
- **Возможность пропустить видео:** Кнопка "Пропустить" с подтверждением
- **Возможность заменить видео:** "Не нравится это видео? Подобрать другое"

## Тестирование

1. Создать тренировку → проверить что она сохранилась в БД
2. Начать видео → проверить что статус меняется на IN_PROGRESS
3. Закрыть приложение → открыть главную → должно быть напоминание
4. Продолжить тренировку → должно открыться текущее видео
5. Завершить все видео → статус должен стать COMPLETED
6. Напоминание больше не должно показываться
