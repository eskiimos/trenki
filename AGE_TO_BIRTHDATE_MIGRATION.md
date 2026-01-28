# Миграция Age → BirthDate

## Что изменилось

Вместо хранения возраста как числа (`age: Int?`), теперь хранится дата рождения (`birthDate: DateTime?`), а возраст вычисляется автоматически.

## Преимущества

1. **Точность**: Дата рождения не меняется, возраст всегда актуален
2. **Автоматика**: Не нужно обновлять возраст каждый год
3. **Автоматическая группировка**: `ageGroup` вычисляется автоматически из даты рождения

## Структура данных

### База данных (Prisma Schema)

```prisma
model Profile {
  birthDate  DateTime?  // Дата рождения
  ageGroup   AgeGroup?  // Автоматически вычисляется
  // ... остальные поля
}

enum AgeGroup {
  CHILD        // 7-10 лет
  TEEN         // 11-17 лет
  YOUNG_ADULT  // 18-34 года
  ADULT        // 35+ лет
}
```

### API

#### Формат ввода (регистрация/редактирование)
```json
{
  "profile": {
    "birthDate": "1999-03-20T00:00:00.000Z"  // ISO 8601
  }
}
```

#### Формат вывода
```json
{
  "profile": {
    "birthDate": "1999-03-20T00:00:00.000Z",
    "age": 25,                               // Вычисляется автоматически
    "ageGroup": "YOUNG_ADULT"                // Вычисляется автоматически
  }
}
```

## Утилиты

### `src/lib/age-utils.ts`

Создан набор утилит для работы с датой рождения:

```typescript
// Вычислить возраст
const age = calculateAge(birthDate);

// Определить возрастную группу
const ageGroup = getAgeGroup(age);

// Вычислить возраст и группу одновременно
const { age, ageGroup } = calculateAgeData(birthDate);

// Проверить валидность даты рождения
const isValid = isValidBirthDate(birthDate);

// Форматировать для input[type="date"]
const formatted = formatDateForInput(birthDate);

// Получить описание группы на русском
const label = getAgeGroupLabel(ageGroup);
// "Молодые взрослые (18-34)"
```

## UI изменения

### Форма редактирования профиля

**Было:**
```tsx
<input type="number" min="1" max="120" placeholder="ЛЕТ" />
```

**Стало:**
```tsx
<input 
  type="date" 
  max={new Date().toISOString().split('T')[0]}
  label="ДАТА РОЖДЕНИЯ"
/>
```

## API изменения

### POST/PUT `/api/profile`

Автоматически вычисляет `ageGroup` из `birthDate`:

```typescript
import { calculateAgeData, isValidBirthDate } from '@/lib/age-utils';

if (profile.birthDate) {
  if (!isValidBirthDate(profile.birthDate)) {
    return NextResponse.json({ error: 'Invalid birth date' }, { status: 400 });
  }
  const { ageGroup } = calculateAgeData(profile.birthDate);
  normalizedProfile.ageGroup = ageGroup;
}
```

### POST `/api/users/register`

Принимает `birthDate` вместо `age`:

```typescript
const { telegramId, firstName, lastName, birthDate, gender } = body;

const { ageGroup } = calculateAgeData(birthDate);

await prisma.user.create({
  data: {
    // ...
    profile: {
      create: {
        birthDate: new Date(birthDate),
        ageGroup,
        gender
      }
    }
  }
});
```

### GET endpoints

Возвращают вычисленный возраст:

```typescript
profile: user.profile ? {
  birthDate: user.profile.birthDate,
  age: user.profile.birthDate ? calculateAge(user.profile.birthDate) : null,
  ageGroup: user.profile.ageGroup,
  // ...
} : null
```

## Проверка onboarding

**Было:**
```typescript
const needsOnboarding = !user.profile?.age || !user.profile?.gender;
```

**Стало:**
```typescript
const needsOnboarding = !user.profile?.birthDate || !user.profile?.gender;
```

## Миграция данных

Миграция создана: `prisma/migrations/.../replace_age_with_birthdate`

⚠️ **Важно**: Существующие данные с `age` будут потеряны. Если есть пользователи в продакшн БД, нужно:

1. Экспортировать данные:
```sql
SELECT id, age FROM "profiles" WHERE age IS NOT NULL;
```

2. Преобразовать возраст в примерную дату рождения:
```typescript
const birthYear = new Date().getFullYear() - age;
const birthDate = new Date(`${birthYear}-01-01`);
```

3. Запустить миграцию:
```bash
npx prisma migrate deploy
```

4. Обновить данные:
```typescript
await prisma.profile.updateMany({
  where: { birthDate: null },
  data: { 
    birthDate: calculatedBirthDate,
    ageGroup: calculatedAgeGroup 
  }
});
```

## Тестирование

### Тестовые пользователи (seed.ts)

Все тестовые пользователи обновлены:

```typescript
profile: {
  create: {
    birthDate: new Date('1999-03-20'),  // Вместо age: 25
    ageGroup: 'YOUNG_ADULT',             // Добавлено
    // ...
  }
}
```

### Проверка

```bash
# Проверить пользователей
npx ts-node check-users.ts

# Запустить dev сервер
npm run dev

# Протестировать:
# 1. Регистрацию нового пользователя
# 2. Редактирование профиля
# 3. Отображение возраста в профиле
```

## Обновлённые файлы

### Схема и миграции
- `prisma/schema.prisma` - заменено `age: Int?` на `birthDate: DateTime?`
- `prisma/migrations/.../replace_age_with_birthdate/` - SQL миграция

### Утилиты
- `src/lib/age-utils.ts` ⭐ НОВЫЙ - утилиты для работы с возрастом

### UI
- `src/app/profile/edit/page.tsx` - форма с date picker

### API
- `src/app/api/profile/route.ts` - POST/PUT с auto ageGroup
- `src/app/api/users/register/route.ts` - регистрация с birthDate
- `src/app/api/admin/users/route.ts` - вычисление age для отображения
- `src/app/api/user/status/route.ts` - вычисление age для отображения

### Auth
- `src/app/api/telegram/route.ts` - проверка birthDate
- `src/app/api/auth/telegram/route.ts` - проверка birthDate
- `src/app/api/auth/telegram-widget/route.ts` - проверка birthDate
- `src/app/api/auth/verify-telegram/route.ts` - проверка birthDate
- `src/app/api/users/check/route.ts` - select birthDate

### Тесты и утилиты
- `prisma/seed.ts` - тестовые данные с birthDate
- `check-users.ts` - отображение возраста из birthDate
- `src/lib/dev-user.ts` - dev пользователь с birthDate

## Логика вычисления возраста

```typescript
function calculateAge(birthDate: Date): number {
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  
  // Если день рождения ещё не наступил в этом году
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  
  return age;
}
```

## Логика определения группы

```typescript
function getAgeGroup(age: number): AgeGroup {
  if (age >= 7 && age <= 10) return 'CHILD';
  if (age >= 11 && age <= 17) return 'TEEN';
  if (age >= 18 && age <= 34) return 'YOUNG_ADULT';
  return 'ADULT';
}
```

## Валидация

```typescript
function isValidBirthDate(birthDate: Date): boolean {
  const today = new Date();
  const age = calculateAge(birthDate);
  
  // Дата не в будущем и возраст 7-100 лет
  return birthDate <= today && age >= 7 && age <= 100;
}
```

## Примеры использования

### В компонентах

```tsx
import { formatDateForInput } from '@/lib/age-utils';

// Загрузка данных
const birthDate = formatDateForInput(user.profile.birthDate);
setFormData({ ...formData, birthDate });

// Отправка данных
const requestData = {
  profile: {
    birthDate: formData.birthDate ? new Date(formData.birthDate).toISOString() : null
  }
};
```

### В API

```typescript
import { calculateAgeData, isValidBirthDate } from '@/lib/age-utils';

// Создание профиля
if (birthDate && !isValidBirthDate(birthDate)) {
  return NextResponse.json({ error: 'Invalid birth date' }, { status: 400 });
}

const { age, ageGroup } = calculateAgeData(birthDate);

// Отображение данных
const profile = {
  birthDate: user.profile.birthDate,
  age: user.profile.birthDate ? calculateAge(user.profile.birthDate) : null,
  ageGroup: user.profile.ageGroup
};
```

## Совместимость

- ✅ TypeScript проверка пройдена
- ✅ Все API endpoints обновлены
- ✅ UI формы обновлены
- ✅ Тестовые данные обновлены
- ✅ Dev утилиты обновлены

## Следующие шаги

1. ✅ Миграция схемы завершена
2. ✅ Код обновлён
3. ⏳ Протестировать в dev окружении
4. ⏳ Протестировать алгоритм генерации тренировок с `ageGroup`
5. ⏳ Подготовить скрипт миграции данных для продакшн (если есть пользователи)
6. ⏳ Деплой в продакшн
