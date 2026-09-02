import { AgeGroup } from '@/generated/prisma';

/**
 * Вычисляет возраст на основе даты рождения
 */
export function calculateAge(birthDate: Date): number {
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  
  // Если день рождения еще не наступил в этом году, вычитаем 1
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  
  return age;
}

/**
 * Определяет возрастную группу на основе возраста
 */
export function getAgeGroup(age: number): AgeGroup {
  if (age >= 7 && age <= 10) {
    return 'CHILD';
  } else if (age >= 11 && age <= 17) {
    return 'TEEN';
  } else if (age >= 18 && age <= 34) {
    return 'YOUNG_ADULT';
  } else {
    return 'ADULT';
  }
}

/**
 * Вычисляет возраст и возрастную группу из даты рождения
 */
export function calculateAgeData(birthDate: Date | string): { age: number; ageGroup: AgeGroup } {
  const date = typeof birthDate === 'string' ? new Date(birthDate) : birthDate;
  const age = calculateAge(date);
  const ageGroup = getAgeGroup(age);
  
  return { age, ageGroup };
}

/**
 * Проверяет валидность даты рождения (не в будущем, разумный диапазон)
 */
export function isValidBirthDate(birthDate: Date | string): boolean {
  const date = typeof birthDate === 'string' ? new Date(birthDate) : birthDate;
  const today = new Date();
  const age = calculateAge(date);
  
  // Проверяем что дата не в будущем и возраст в разумных пределах (7-100 лет)
  return date <= today && age >= 7 && age <= 100;
}

/**
 * Форматирует дату для input[type="date"]
 */
export function formatDateForInput(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toISOString().split('T')[0];
}

/**
 * Получает возрастную группу описание на русском
 */
export function getAgeGroupLabel(ageGroup: AgeGroup): string {
  const labels: Record<AgeGroup, string> = {
    'CHILD': 'Дети (7-10 лет)',
    'TEEN': 'Подростки (11-17 лет)',
    'YOUNG_ADULT': 'Молодые взрослые (18-34)',
    'ADULT': 'Взрослые (35+)'
  };
  
  return labels[ageGroup];
}

// ─── Хелперы колёсиков даты рождения (правка владельца: «гггг-мм-дд») ───────
// Чистые функции — тестируются без DOM (tests/lib/age-utils.test.ts).

/** Сколько дней в месяце (month: 1..12), с учётом високосных лет. */
export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** День, обрезанный по длине месяца: 31 января → февраль даёт 28/29. */
export function clampDay(year: number, month: number, day: number): number {
  return Math.min(Math.max(1, day), daysInMonth(year, month));
}

/** 'YYYY-MM-DD' без таймзонных сдвигов (toISOString у локальной даты может дать вчера). */
export function toDateString(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Разбор 'YYYY-MM-DD'. null, если формат не тот или дата не существует. */
export function parseDateString(
  value: string | null | undefined,
): { year: number; month: number; day: number } | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > daysInMonth(year, month)) return null;
  return { year, month, day };
}
