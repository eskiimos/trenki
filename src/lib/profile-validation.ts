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
