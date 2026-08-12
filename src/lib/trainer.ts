// Опыт тренера деривируется из года начала карьеры (careerStartYear), а не
// хранится числом — так он автоматически растёт +1 каждый 1 января без крона
// (тот же приём, что calculateAge из birthDate в age-utils.ts). Legacy-поле
// experience остаётся фолбэком для записей, где careerStartYear ещё не задан.

export interface TrainerExperienceInput {
  careerStartYear?: number | null;
  experience?: number | null;
}

/** Опыт тренера в годах на текущий момент (≥ 0). */
export function trainerExperienceYears(
  t: TrainerExperienceInput,
  now: Date = new Date(),
): number {
  if (t.careerStartYear != null) {
    return Math.max(0, now.getFullYear() - t.careerStartYear);
  }
  return Math.max(0, t.experience ?? 0);
}

/** Год начала карьеры из введённого «стажа в годах» (для сохранения из формы). */
export function careerStartYearFromExperience(
  experienceYears: number,
  now: Date = new Date(),
): number {
  return now.getFullYear() - Math.max(0, Math.floor(experienceYears));
}
