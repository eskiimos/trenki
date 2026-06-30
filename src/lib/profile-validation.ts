// Валидация полей профиля спортсмена (имя / фамилия / игровой номер).
// Один источник правды для клиента (маска ввода) и сервера (защита от обхода
// маски — нельзя доверять данным из тела запроса, см. CLAUDE.md).

export const NAME_MAX_FIRST = 10; // имя
export const NAME_MAX_LAST = 15; // фамилия

// Разрешена ТОЛЬКО кириллица (включая Ёё) и дефис (для составных фамилий).
// А-Я не включает Ё, поэтому Ёё добавлены явно. Латиница/цифры/пробелы — нельзя.
const DISALLOWED_NAME_CHARS = /[^А-Яа-яЁё-]/g;
const VALID_NAME = /^[А-Яа-яЁё-]*$/;

/** Убирает всё кроме кириллицы и дефиса, обрезает до max. Для onChange и загрузки формы. */
export function sanitizeName(value: string, max: number): string {
  return value.replace(DISALLOWED_NAME_CHARS, '').slice(0, max);
}

// Минимум 2 кириллические буквы — чтобы не проходили '', '-', 'А', 'А-' и т.п.
export const NAME_MIN_LETTERS = 2;
const CYRILLIC_LETTER = /[А-Яа-яЁё]/g;

/** Корректно: только кириллица/дефис, длина ≤ max и не менее 2 кириллических букв. */
export function isValidName(value: string, max: number): boolean {
  if (value.length > max || !VALID_NAME.test(value)) return false;
  return (value.match(CYRILLIC_LETTER) || []).length >= NAME_MIN_LETTERS;
}

/** Маска ввода игрового номера: только цифры, без ведущих нулей, максимум 2. */
export function sanitizeNumberInput(value: string): string {
  return value.replace(/\D/g, '').replace(/^0+/, '').slice(0, 2);
}

/** Номер валиден, если пусто (null) или целое 1..99. */
export function isValidGameNumber(n: number | null | undefined): boolean {
  if (n === null || n === undefined) return true;
  return Number.isInteger(n) && n >= 1 && n <= 99;
}

// Антропометрия. Границы — как в HTML-инпутах ЛК; сервер их повторяет, чтобы
// нельзя было обойти маску (нельзя доверять телу запроса, см. CLAUDE.md).
export const HEIGHT_MIN = 100; // см
export const HEIGHT_MAX = 230;
export const WEIGHT_MIN = 30; // кг
export const WEIGHT_MAX = 150;

/** Рост валиден, если null или целое в пределах [HEIGHT_MIN, HEIGHT_MAX]. */
export function isValidHeight(n: number | null | undefined): boolean {
  if (n === null || n === undefined) return true;
  return Number.isInteger(n) && n >= HEIGHT_MIN && n <= HEIGHT_MAX;
}

/** Вес валиден, если null или целое в пределах [WEIGHT_MIN, WEIGHT_MAX]. */
export function isValidWeight(n: number | null | undefined): boolean {
  if (n === null || n === undefined) return true;
  return Number.isInteger(n) && n >= WEIGHT_MIN && n <= WEIGHT_MAX;
}

/** Приводит рост к допустимому диапазону; null/NaN → null. */
export function clampHeight(n: number | null | undefined): number | null {
  if (n === null || n === undefined || Number.isNaN(n)) return null;
  return Math.min(HEIGHT_MAX, Math.max(HEIGHT_MIN, Math.round(n)));
}

/** Приводит вес к допустимому диапазону; null/NaN → null. */
export function clampWeight(n: number | null | undefined): number | null {
  if (n === null || n === undefined || Number.isNaN(n)) return null;
  return Math.min(WEIGHT_MAX, Math.max(WEIGHT_MIN, Math.round(n)));
}
