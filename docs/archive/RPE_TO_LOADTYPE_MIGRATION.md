# 🔄 Миграция с RPE на LoadType алгоритм

## ❌ Проблема старой системы:

### Старый алгоритм (RPE-based):
```typescript
// Подбор видео по RPE (Rate of Perceived Exertion)
const video = await prisma.video.findFirst({
  where: {
    category: 'STRENGTH', // Грубая категория
    rpeМін: { lte: 7 },   // Субъективная оценка
    rpeМакс: { gte: 5 },
  }
});
```

**Недостатки:**
1. ❌ **Субъективность**: RPE = "ощущение нагрузки" (слишком размыто)
2. ❌ **Не учитывает характеристики**: Все пользователи получают одинаковые тренировки
3. ❌ **Нет связи с приростом**: RPE не показывает, какая характеристика развивается
4. ❌ **Грубая категоризация**: category = STRENGTH/ENDURANCE/TECHNIQUE (всего 3 типа)
5. ❌ **Несоответствие**: Генерация тренировок использует RPE, а прирост характеристик — LoadType

---

## ✅ Новая система (LoadType-based):

### Новый алгоритм v2.0:
```typescript
// Умный подбор по LoadType тегам
const video = await prisma.video.findFirst({
  where: {
    videoTags: {
      some: {
        tag: {
          tagType: 'LOAD',
          loadType: { in: [LoadType.POWER, LoadType.MAX_STRENGTH] }
        }
      }
    }
  }
});
```

**Преимущества:**
1. ✅ **Точность**: LoadType точно указывает, что развивает видео (POWER, SPEED, ENDURANCE и т.д.)
2. ✅ **Персонализация**: Анализируем характеристики пользователя (какая слабее → развиваем её)
3. ✅ **Связь с приростом**: LoadType влияет на конкретную характеристику (см. таблицу)
4. ✅ **13 типов нагрузки**: Детальная классификация (а не 3)
5. ✅ **Целостность**: Генерация и прирост используют одну систему

---

## 📊 Маппинг LoadType → Характеристики:

| LoadType | Характеристика | Emoji |
|----------|---------------|-------|
| `MAX_STRENGTH`, `POWER` | 💪 Сила (`ratingPower`) | 💪 |
| `SPEED` | ⚡ Скорость (`ratingSpeed`) | ⚡ |
| `AEROBIC_ENDURANCE`, `ANAEROBIC_ENDURANCE`, `STRENGTH_ENDURANCE` | 🫀 Выносливость (`ratingEndurance`) | 🫀 |
| `AGILITY`, `TECHNICAL_SKILL` | 🎯 Техника (`ratingTechnique`) | 🎯 |
| `MOBILITY`, `STATIC_STRETCH`, `DYNAMIC_STRETCH` | 🤸 Гибкость (`ratingFlexibility`) | 🤸 |

---

## 🧠 Логика нового алгоритма:

### 1. Анализ пользователя:
```typescript
const characteristics = {
  POWER: profile.ratingPower,       // 65.5
  SPEED: profile.ratingSpeed,       // 58.3 ← СЛАБАЯ
  ENDURANCE: profile.ratingEndurance, // 72.1
  TECHNIQUE: profile.ratingTechnique, // 68.9
  FLEXIBILITY: profile.ratingFlexibility, // 61.4
};

// Сортируем: находим слабую, среднюю, сильную
const weakest = 'SPEED'; // 58.3 ← Будем развивать!
```

### 2. Структура тренировки:
```
🏃 РАЗМИНКА (5-10 мин)
   └─ LoadType: MOBILITY, DYNAMIC_STRETCH

💪 ОСНОВНАЯ ЧАСТЬ (20-30 мин)
   └─ LoadType: Развиваем СЛАБУЮ характеристику
   └─ Пример: Если SPEED слабая → подбираем видео с LoadType.SPEED

🧘 ЗАМИНКА (5-10 мин)
   └─ LoadType: STATIC_STRETCH, MOBILITY
```

### 3. Учёт сложности:
```typescript
// loadDirection определяет difficulty видео
const difficultyMap = {
  LIGHT: [BEGINNER, INTERMEDIATE],
  MEDIUM: [INTERMEDIATE, ADVANCED],
  HIGH: [ADVANCED, EXPERT],
};
```

---

## 🚀 Что изменено:

### ✅ Создан новый endpoint:
- **`/api/training/generate-v2`** - Новый алгоритм на LoadType
- Старый `/api/training/generate` - Остался (для обратной совместимости)

### ⚠️ Поля RPE - Deprecated:
- `Video.rpeМін` - Больше НЕ используется в генерации
- `Video.rpeМакс` - Больше НЕ используется в генерации
- Поля НЕ удалены (для обратной совместимости со старыми данными)
- **Рекомендация**: Можно удалить из schema через миграцию позже

### ✅ LoadType теги - Основа:
- Все видео ДОЛЖНЫ иметь LoadType теги
- Админка автоматически создаёт LoadType при сохранении видео
- Скрипт `prisma/add-load-type-tags.ts` обновил существующие видео

---

## 📝 Примеры:

### Пример 1: Пользователь со слабой СКОРОСТЬЮ
```
Характеристики:
- Сила: 70
- Скорость: 55 ← СЛАБАЯ
- Выносливость: 68
- Техника: 65
- Гибкость: 60

Тренировка:
1. Разминка: "Динамическая растяжка" (DYNAMIC_STRETCH)
2. Основная: "Спринты с сопротивлением" (SPEED) ← Развиваем слабую
3. Заминка: "Стретчинг ног" (STATIC_STRETCH)

Прирост после тренировки:
- Скорость: 55 → 57.8 (+2.8) ← Основной фокус
- Гибкость: 60 → 61.2 (+1.2) ← Бонус от разминки/заминки
```

### Пример 2: Пользователь со слабой СИЛОЙ
```
Характеристики:
- Сила: 52 ← СЛАБАЯ
- Скорость: 68
- Выносливость: 70
- Техника: 65
- Гибкость: 63

Тренировка:
1. Разминка: "Суставная гимнастика" (MOBILITY)
2. Основная: "Силовая тренировка верха" (POWER) ← Развиваем слабую
3. Заминка: "Йога для восстановления" (STATIC_STRETCH)

Прирост после тренировки:
- Сила: 52 → 54.5 (+2.5) ← Основной фокус
- Гибкость: 63 → 64.1 (+1.1) ← Бонус
```

---

## 🔧 Как использовать новый алгоритм:

### Frontend (вызов API):
```typescript
const response = await fetch('/api/training/generate-v2', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: user.id,
    loadDirection: 'MEDIUM', // LIGHT | MEDIUM | HIGH
    availableTime: 45, // минуты
  })
});

const { workout, meta } = await response.json();

// Результат:
workout.modules = [
  { id, title, duration, trainer, loadTypes: ['MOBILITY'], moduleType: 'WARMUP' },
  { id, title, duration, trainer, loadTypes: ['SPEED'], moduleType: 'MAIN', focusArea: 'SPEED' },
  { id, title, duration, trainer, loadTypes: ['STATIC_STRETCH'], moduleType: 'COOLDOWN' },
];

meta = {
  focusArea: 'SPEED', // Какая характеристика развивается
  difficulty: 'MEDIUM',
  modulesUsed: 3,
  totalDuration: 2700, // секунды
};
```

---

## 📊 Сравнение:

| Параметр | Старый (RPE) | Новый (LoadType) |
|----------|--------------|-----------------|
| **Точность подбора** | ❌ Субъективная (RPE 5-7) | ✅ Объективная (LoadType.SPEED) |
| **Персонализация** | ❌ Одинаковые для всех | ✅ Под каждого пользователя |
| **Связь с характеристиками** | ❌ Нет | ✅ Прямая связь |
| **Количество типов** | ❌ 3 category | ✅ 13 LoadType |
| **Целостность системы** | ❌ Генерация ≠ Прирост | ✅ Единая система |
| **Развитие слабых сторон** | ❌ Случайный подбор | ✅ Умный анализ |

---

## 🎯 Рекомендации:

### Сейчас:
1. ✅ Использовать новый `/api/training/generate-v2` для генерации тренировок
2. ✅ Все новые видео в админке создают LoadType теги автоматически
3. ⚠️ Старый `/api/training/generate` оставлен для совместимости (не удалять пока)

### Позже:
1. 🔄 Переключить весь фронтенд на `/api/training/generate-v2`
2. 🗑️ Удалить старый `/api/training/generate`
3. 🗑️ Удалить поля `rpeМін`, `rpeМакс` из schema через миграцию
4. 🗑️ Удалить `/api/training/assessment` (если используется только для RPE)

---

## ✅ Итог:

**Новая система LoadType** — это полностью переосмысленный алгоритм генерации тренировок:
- 🎯 **Умный**: Анализирует характеристики пользователя
- 💪 **Целенаправленный**: Развивает слабые стороны
- 📈 **Эффективный**: Прирост идёт туда, куда нужно
- 🔗 **Целостный**: Единая система от генерации до прироста

**RPE остаётся в прошлом** — LoadType это будущее! 🚀
