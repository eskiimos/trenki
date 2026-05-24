# Система характеристик и прогресса

## 🎯 Быстрый старт

### Для пользователя:
1. **Стартовый опрос**: `/onboarding/characteristics` - 3-шаговая форма
2. **Просмотр характеристик**: `/profile` - показывает все рейтинги и потенциал
3. **Тестирование модалки**: `/test-characteristics` - демо прироста

### Для разработчика:
- **Утилиты**: `src/lib/characteristics.ts` - расчеты прогресса
- **Модалка**: `src/components/CharacteristicsGainModal.tsx` - анимация прироста
- **API**: 
  - POST `/api/profile/characteristics` - сохранение опроса
  - POST `/api/training/complete-module` - завершение модуля
  - POST `/api/training/complete` - завершение тренировки

## Обзор

Система прогресса основана на 5 ключевых характеристиках:
- **ratingPower** (сила)
- **ratingSpeed** (скорость)
- **ratingEndurance** (выносливость)
- **ratingTechnique** (техника)
- **ratingFlexibility** (гибкость)
- **potential** (средний показатель - "потенциал")

## Стартовый опрос

### Страница: `/onboarding/characteristics`

**Шаг 1: Самооценка (1-10)**
- Сила, Скорость, Выносливость, Техника, Гибкость

**Шаг 2: Опыт**
- Сколько лет в хоккее (коэффициент 1.53-1.75)
- Частота тренировок (коэффициент 1.53-1.75)

**Шаг 3: Игровая практика**
- Частота матчей (коэффициент 1.53-1.75)
- Сложность игровых ситуаций (коэффициент 1.53-1.75)

### Расчет

```
k_mastery = k1 × k2 × k3 × k4  (от 5.5 до 9.4)
rating_X = raw_X × k_mastery
rating_X ∈ [20, 75]  (ограничение на старте)
potential = среднее арифметическое всех rating
```

## Прогресс после тренировки

### Формула прироста

```
прирост = base_gain * ((100 - current_value) / 100) * multiplier
base_gain = 0.5
multiplier = 1 или 0.5
```

### Маппинг LoadType → Характеристики

```typescript
SPEED              → +скорость, +выносливость
POWER              → +сила, +0.5 скорость
MAX_STRENGTH       → +сила
STRENGTH_ENDURANCE → +выносливость
ANAEROBIC_ENDURANCE → +выносливость
AEROBIC_ENDURANCE  → +выносливость
AGILITY            → +техника
MOBILITY           → +гибкость, +0.5 техника
STATIC_STRETCH     → +гибкость, +0.5 техника
DYNAMIC_STRETCH    → +гибкость, +0.5 техника
PREHAB             → +гибкость, +0.5 сила
TECHNICAL_SKILL    → +техника
```

### Подсчет за тренировку

1. Каждый модуль тренировки имеет теги LoadType
2. Считаем количество вхождений каждого тега
3. Рассчитываем прирост для каждой затронутой характеристики
4. Умножаем на количество модулей с этим тегом

**Пример:**
Тренировка из 4 модулей: [DYNAMIC_STRETCH, POWER, TECHNICAL_SKILL, PREHAB]
- POWER встретился 1 раз → +сила, +0.5 скорость
- DYNAMIC_STRETCH встретился 1 раз → +гибкость, +0.5 техника
- TECHNICAL_SKILL встретился 1 раз → +техника
- PREHAB встретился 1 раз → +гибкость, +0.5 сила

Итого:
- Сила: 1.5 модуля (1 + 0.5)
- Скорость: 0.5 модуля
- Гибкость: 2 модуля (1 + 1)
- Техника: 1.5 модуля (0.5 + 1)

## API Endpoints

### POST /api/profile/characteristics
Сохранение стартовых характеристик
```json
{
  "userId": "telegramId",
  "rawPower": 8,
  "rawSpeed": 6,
  "rawEndurance": 7,
  "rawTechnique": 9,
  "rawFlexibility": 5,
  "yearsInHockey": "MORE_THAN_5",
  "trainingFrequency": "2_TO_4_TIMES",
  "matchFrequency": "ONCE_A_WEEK",
  "gameDifficulty": "HARD"
}
```

### POST /api/training/complete-module
Завершение одного модуля
```json
{
  "userId": "telegramId",
  "videoId": "videoId",
  "sessionId": "sessionId"
}
```

**Ответ:**
```json
{
  "success": true,
  "gains": {
    "ratingPower": 0.15,
    "ratingSpeed": 0.12,
    ...
  },
  "newCharacteristics": {
    "ratingPower": 70.4,
    "ratingSpeed": 53.0,
    ...
  },
  "modulesToday": 1
}
```

### POST /api/training/complete
Завершение полной тренировки
```json
{
  "userId": "telegramId",
  "sessionId": "sessionId"
}
```

**Ответ:**
```json
{
  "success": true,
  "gains": { ... },
  "newCharacteristics": { ... },
  "trainingsToday": 1
}
```

## Ограничения

- **Модулей в день**: 4 максимум
- **Тренировок в день**: 2 максимум
- **Максимум характеристики**: 100
- **Минимум на старте**: 20
- **Максимум на старте**: 75

## База данных

### Profile Model
```prisma
model Profile {
  // Новые характеристики
  ratingPower       Float  @default(0)
  ratingSpeed       Float  @default(0)
  ratingEndurance   Float  @default(0)
  ratingTechnique   Float  @default(0)
  ratingFlexibility Float  @default(0)
  potential         Float  @default(0)
  
  // Стартовый опрос
  rawPower          Int?
  rawSpeed          Int?
  rawEndurance      Int?
  rawTechnique      Int?
  rawFlexibility    Int?
  kMastery          Float?
  
  // Ограничения
  trainingsToday    Int      @default(0)
  modulesToday      Int      @default(0)
  lastTrainingDate  DateTime?
  fatigue           Float    @default(0)
}
```

## Утилиты

### /src/lib/characteristics.ts

Основные функции:
- `calculateGain(currentValue, baseGain, multiplier)` - расчет прироста
- `calculateWorkoutGains(moduleTags, currentCharacteristics)` - прирост за тренировку
- `calculatePotential(characteristics)` - пересчет потенциала
- `LOAD_TYPE_TO_CHARACTERISTICS` - маппинг LoadType → характеристики

## UI Компоненты

### Профиль (/profile)
- **Потенциал**: Крупное отображение с градиентом
- **Характеристики**: 5 баров с emoji, значением и цветным прогресс-баром
- **Дневной прогресс**: Модули (0/4) и Тренировки (0/2) с прогресс-барами
- **Приглашение**: Если характеристики = 0, показываем кнопку стартового опроса

### Модалка прироста (CharacteristicsGainModal)
- Анимированное появление
- Список характеристик с приростом
- Цветные прогресс-бары
- Новый потенциал
- Тестовая страница: `/test-characteristics`

## Этапы разработки

### ✅ Этап 1: База данных
- Миграция схемы
- 13 новых полей в Profile
- Seed данные

### ✅ Этап 2: Стартовый опрос
- `/onboarding/characteristics`
- API `/api/profile/characteristics`
- Расчет k_mastery и ratings

### ✅ Этап 3: Прогресс
- `/src/lib/characteristics.ts`
- API `/api/training/complete-module`
- API `/api/training/complete` (обновлен)
- Дневные лимиты

### ✅ Этап 4: UI
- Обновлен профиль с новыми характеристиками
- Компонент CharacteristicsGainModal
- Дневной прогресс
- Тестовая страница

### ✅ Этап 5: Интеграция в тренировки
- Модалка прироста в `/training/workout` (полная тренировка)
- Кнопка "Завершить модуль" в `/video/[id]` (одиночное видео)
- Toast компонент для уведомлений
- Обработка дневных лимитов с уведомлениями

## TODO

- [ ] История тренировок с графиками прогресса
- [ ] Система усталости (fatigue)
- [ ] Убывание характеристик при пропуске тренировок
- [ ] Стрики и достижения
- [ ] История изменений характеристик (графики)
- [ ] Добавить LoadType теги к существующим видео
