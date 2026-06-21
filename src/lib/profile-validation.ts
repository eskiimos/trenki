// Валидация полей профиля спортсмена (имя / фамилия / игровой номер).
// Один источник правды для клиента (маска ввода) и сервера (защита от обхода
// маски — нельзя доверять данным из тела запроса, см. CLAUDE.md).

export const NAME_MAX_FIRST = 10; // имя
export const NAME_MAX_LAST = 15; // фамилия

// Разрешены только буквы (латиница + кириллица, включая Ёё) и дефис.
// А-Я не включает Ё, поэтому Ёё добавлены явно.
const DISALLOWED_NAME_CHARS = /[^A-Za-zА-Яа-яЁё-]/g;
const VALID_NAME = /^[A-Za-zА-Яа-яЁё-]*$/;

/** Убирает запрещённые символы и обрезает до max длины. Для onChange и загрузки формы. */
export function sanitizeName(value: string, max: number): string {
  return value.replace(DISALLOWED_NAME_CHARS, '').slice(0, max);
}

// Хотя бы одна буква — чтобы не проходили имена из одних дефисов ('-', '--').
const HAS_LETTER = /[A-Za-zА-Яа-яЁё]/;

/** Формат и длина корректны. Пустая строка допустима (имя не обязательно),
 *  но непустое значение должно содержать хотя бы одну букву. */
export function isValidName(value: string, max: number): boolean {
  if (value.length > max || !VALID_NAME.test(value)) return false;
  return value.length === 0 || HAS_LETTER.test(value);
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
