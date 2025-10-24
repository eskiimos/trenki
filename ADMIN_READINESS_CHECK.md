# Проверка готовности БД и админки к алгоритму тренировок

## ✅ ЧТО УЖЕ ГОТОВО

### 1. База данных (schema.prisma)

#### TrainingModule - ПОЛНОСТЬЮ ГОТОВА ✅
```prisma
model TrainingModule {
  id              String         @id @default(cuid())
  name            String
  description     String?
  type            ModuleType     // ✅ WARMUP/FITNESS/TECHNIQUE/COOLDOWN
  duration        Int
  videoId         String?        // ✅ Связь с Video
  order           Int
  
  // ✅ ВСЕ НУЖНЫЕ ПОЛЯ ДЛЯ АЛГОРИТМА ЕСТЬ:
  loadType        LoadType?      // ✅ Тип нагрузки
  muscleGroup     MuscleGroup?   // ✅ Целевая группа мышц
  complexity      Complexity     // ✅ Сложность
  rpeMin          Int?           // ✅ Минимальный RPE (1-10)
  rpeMax          Int?           // ✅ Максимальный RPE (1-10)
  
  video           Video?         // ✅ Связь с видео
}
```

#### Все необходимые Enum - ГОТОВЫ ✅

**ModuleType** (4 типа модулей):
- WARMUP - Разминка
- FITNESS - Физическая подготовка
- TECHNIQUE - Техника
- COOLDOWN - Заминка

**LoadType** (12 типов нагрузки):
- SPEED - Скорость
- POWER - Мощность
- MAX_STRENGTH - Максимальная сила
- STRENGTH_ENDURANCE - Силовая выносливость
- ANAEROBIC_ENDURANCE - Анаэробная выносливость
- AEROBIC_ENDURANCE - Аэробная выносливость
- AGILITY - Ловкость
- MOBILITY - Мобильность
- STATIC_STRETCH - Статическая растяжка
- DYNAMIC_STRETCH - Динамическая растяжка
- PREHAB - ЛФК
- TECHNICAL_SKILL - Техника

**MuscleGroup** (9 групп мышц):
- FULL_BODY - Все тело
- LOWER_BODY - Низ тела
- UPPER_PULL - Верх тяга
- UPPER_PUSH - Верх жим
- CORE_STABILITY - Кор стабилизация
- CORE_DYNAMICS - Кор динамика
- PREHAB_SHOULDER - ЛФК плечо
- PREHAB_KNEE - ЛФК колено
- PREHAB_BACK - ЛФК спина

**Complexity** (4 уровня):
- BEGINNER - Новичок
- AMATEUR - Любитель
- ADVANCED - Продвинутый
- PRO - Профессионал

### 2. Model Video - ГОТОВА ✅

```prisma
model Video {
  id              String            @id
  title           String
  description     String?
  duration        Int               // секунды
  videoUrl        String            // ✅ Kinescope/YouTube URL
  thumbnail       String?
  category        VideoCategory
  difficulty      VideoDifficulty
  trainerId       String
  
  trainingModules TrainingModule[]  // ✅ Связь с модулями
}
```

### 3. Админка для загрузки видео - ГОТОВА ✅

**Путь**: `/admin/videos`

**Функционал**:
- ✅ Загрузка видео по URL (Kinescope/YouTube)
- ✅ Автоматическое получение метаданных из Kinescope
- ✅ Загрузка превью (URL или файл)
- ✅ Установка категории, сложности
- ✅ Привязка к тренеру
- ✅ Теги через MultiLevelTagFilter
- ✅ Оборудование
- ✅ Редактирование существующих видео
- ✅ Удаление видео

## ❌ ЧЕГО НЕ ХВАТАЕТ

### 1. Админка для создания TrainingModule - НЕ СУЩЕСТВУЕТ ❌

**Проблема**: Есть админка для Video, но НЕТ админки для TrainingModule!

**Что нужно создать**:

#### Страница `/admin/training-modules`

**Форма создания модуля должна включать**:

```typescript
// Основные поля
- name: string              // Название модуля
- description: string       // Описание
- type: ModuleType          // Dropdown: WARMUP/FITNESS/TECHNIQUE/COOLDOWN
- duration: number          // Длительность в секундах (авто из видео)
- videoId: string           // Dropdown со списком видео

// Для алгоритма (ОБЯЗАТЕЛЬНО!)
- loadType: LoadType        // Dropdown: SPEED, POWER, MAX_STRENGTH и т.д.
- muscleGroup: MuscleGroup  // Dropdown: FULL_BODY, LOWER_BODY и т.д.
- complexity: Complexity    // Dropdown: BEGINNER, AMATEUR, ADVANCED, PRO
- rpeMin: number            // Input: 1-10
- rpeMax: number            // Input: 1-10
- order: number             // Порядок (обычно 0)
```

**Визуализация**:
```
┌─────────────────────────────────────────────────────────┐
│ Создание тренировочного модуля                          │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ Название:      [_____________________________]          │
│                                                         │
│ Описание:      [_____________________________]          │
│                [_____________________________]          │
│                                                         │
│ Тип модуля:    [▼ WARMUP       ]                       │
│                                                         │
│ Видео:         [▼ Выберите видео...           ]        │
│                Длительность: 8:35 (авто)               │
│                                                         │
│ ┌─ Параметры для алгоритма ──────────────────┐         │
│ │                                              │         │
│ │ Тип нагрузки:    [▼ DYNAMIC_STRETCH    ]   │         │
│ │                                              │         │
│ │ Группа мышц:     [▼ FULL_BODY          ]   │         │
│ │                                              │         │
│ │ Сложность:       [▼ BEGINNER           ]   │         │
│ │                                              │         │
│ │ RPE диапазон:    От [3] до [5]              │         │
│ │                  (1-10 шкала)               │         │
│ │                                              │         │
│ └──────────────────────────────────────────────┘         │
│                                                         │
│ Порядок: [0]                                           │
│                                                         │
│         [Отмена]  [Создать модуль]                     │
└─────────────────────────────────────────────────────────┘
```

### 2. API endpoints для TrainingModule - НЕТ ❌

**Нужно создать**:

```
POST   /api/training/modules          - Создать модуль
GET    /api/training/modules          - Получить все модули
GET    /api/training/modules/:id      - Получить модуль по ID
PUT    /api/training/modules/:id      - Обновить модуль
DELETE /api/training/modules/:id      - Удалить модуль
```

### 3. UI для просмотра модулей в админке - НЕТ ❌

**Нужна таблица/список модулей**:

```
┌──────────────────────────────────────────────────────────────┐
│ Все тренировочные модули                                     │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│ [Разминка] Динамическая растяжка всего тела                 │
│ 📹 Утренняя мобилизация с Андреем                           │
│ 🏋️ DYNAMIC_STRETCH | 💪 FULL_BODY | ⭐ BEGINNER | RPE 3-5   │
│ [Редактировать] [Удалить] [Просмотр видео]                  │
│                                                              │
│ [ОФП] Взрывная мощность нижней части тела                   │
│ 📹 Плиометрика для хоккеистов                               │
│ 🏋️ POWER | 💪 LOWER_BODY | ⭐ ADVANCED | RPE 8-10           │
│ [Редактировать] [Удалить] [Просмотр видео]                  │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

## 📋 ПЛАН ДЕЙСТВИЙ

### Шаг 1: Создать API для TrainingModule
- [ ] `src/app/api/training/modules/route.ts` - GET, POST
- [ ] `src/app/api/training/modules/[id]/route.ts` - GET, PUT, DELETE

### Шаг 2: Создать админку
- [ ] `src/app/admin/training-modules/page.tsx` - Главная страница
- [ ] Форма создания/редактирования модуля
- [ ] Список модулей с фильтрами
- [ ] Интеграция с существующими видео

### Шаг 3: Добавить валидацию
- [ ] Проверка диапазона RPE (1-10)
- [ ] Проверка соответствия loadType для каждого type
- [ ] Проверка наличия videoId

### Шаг 4: Seed данные (опционально)
- [ ] Создать seed-training-modules.ts с примерами
- [ ] Минимум 32-43 модуля для покрытия всех комбинаций

## 🎯 МИНИМАЛЬНЫЙ НАБОР МОДУЛЕЙ

Для работы алгоритма нужно минимум:

### WARMUP (6-9 модулей)
- 3x DYNAMIC_STRETCH (FULL_BODY, BEGINNER/AMATEUR/ADVANCED)
- 3x MOBILITY (FULL_BODY/LOWER_BODY/UPPER_BODY)
- 2x AGILITY (разная сложность)

### FITNESS (12-15 модулей)
- 3x SPEED (разные muscleGroup, сложности, RPE)
- 3x POWER (LOWER_BODY, UPPER_PUSH/PULL)
- 2x MAX_STRENGTH (разные группы)
- 3x STRENGTH_ENDURANCE
- 2x ANAEROBIC_ENDURANCE
- 2x AEROBIC_ENDURANCE

### TECHNIQUE (8-10 модулей)
- 5x TECHNICAL_SKILL (разные сложности, RPE)
- 3x AGILITY (координация)
- 2x комбо

### COOLDOWN (6-9 модулей)
- 4x STATIC_STRETCH (разные группы мышц)
- 2x DYNAMIC_STRETCH (легкая)
- 3x PREHAB (SHOULDER, KNEE, BACK)

## ⚠️ ВАЖНО!

**БЕЗ АДМИНКИ ДЛЯ TrainingModule система НЕ МОЖЕТ РАБОТАТЬ!**

Сейчас:
- ✅ Видео можно загружать
- ✅ База данных готова
- ✅ Алгоритм готов выбирать модули
- ❌ НО создавать модули НЕГДЕ!

**Следующий шаг**: Создать `/admin/training-modules` страницу и API.
