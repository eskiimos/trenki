// Единый хелпер русского склонения числительных (правило mod10/mod100).
// Раньше эта логика была скопирована в ~8 местах (StreakChip, AssignmentsBanner,
// parent-digest, workout/page, nudges…) — держим один источник здесь.

/** plural(2, ['модуль','модуля','модулей']) → 'модуля' (ТОЛЬКО слово, без числа). */
export function plural(n: number, forms: [string, string, string]): string {
  const abs = Math.abs(n);
  const mod10 = abs % 10;
  const mod100 = abs % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1];
  return forms[2];
}

/** «1 год» / «4 года» / «5 лет» / «21 год» / «54 года». */
export function pluralYears(n: number): string {
  return `${n} ${plural(n, ['год', 'года', 'лет'])}`;
}

/** «1 день» / «2 дня» / «5 дней». */
export function pluralDays(n: number): string {
  return `${n} ${plural(n, ['день', 'дня', 'дней'])}`;
}
