// Сборка тренировки одного дня микроцикла. Вынесено из generate.ts, чтобы
// переиспользовать в эндпоинте пересборки дня «раскисление» под выбранную
// атлетом часть тела (низ/верх/всё). Логика сборки не менялась.

import {
  AgeGroup,
  TrainingGoal,
  EnergyState,
  MuscleGroup,
} from '@/generated/prisma';
import {
  GOAL_TO_MUSCLE_GROUPS,
  GOAL_TO_LOAD_TYPES,
  getRPERange,
  getWorkoutStructure,
  applyAgeModifiers,
  getComplexityLevel,
  getAllowedComplexityLevels,
  type WorkoutStructure,
  type ModuleDirections,
} from '@/lib/training-algorithm-v3';
import { buildWorkout, type BuiltWorkout } from '@/lib/training/build-workout';
import type { DayKind } from '@/lib/microcycle/week-plan';

// Структура дня по виду: полный (физ/техника) / только разминка / разминка+растяжка.
export function structureForKind(
  kind: DayKind,
  energyState: EnergyState,
  potential: number,
): WorkoutStructure {
  if (kind === 'WARMUP') {
    return { moduleCount: 1, includeWarmup: true, includeFitness: false, includeTechnique: false, includeCooldown: false };
  }
  if (kind === 'WARMUP_STRETCH') {
    return { moduleCount: 2, includeWarmup: true, includeFitness: false, includeTechnique: false, includeCooldown: true };
  }
  return getWorkoutStructure(energyState, potential);
}

export interface DaySpec {
  goal: TrainingGoal;
  energyState: EnergyState;
  kind: DayKind;
}
export interface DayProfile {
  potential: number;
  ageGroup?: AgeGroup;
}

/** Собирает тренировку дня. muscleGroupsOverride — точечная замена мышечных
 *  групп (для «раскисления» по части тела). */
export async function buildMicrocycleDayWorkout(
  userId: string,
  profile: DayProfile,
  day: DaySpec,
  muscleGroupsOverride?: Partial<ModuleDirections>,
): Promise<BuiltWorkout & { rpeAvg: number }> {
  const complexityLevel = getComplexityLevel(profile.potential);
  const allowedComplexityLevels = getAllowedComplexityLevels(complexityLevel, day.energyState);
  const structure = structureForKind(day.kind, day.energyState, profile.potential);
  const rpeRange = getRPERange(day.energyState, profile.potential, profile.ageGroup);

  const baseMuscle = GOAL_TO_MUSCLE_GROUPS[day.goal];
  const muscleGroups: ModuleDirections = { ...baseMuscle, ...(muscleGroupsOverride ?? {}) };

  // Клонируем load types: applyAgeModifiers возвращает новый массив, без клона
  // мутировали бы общую константу между днями/юзерами (в cron'е критично).
  const baseLoad = GOAL_TO_LOAD_TYPES[day.goal];
  const loadTypes = {
    ...baseLoad,
    fitness: applyAgeModifiers(baseLoad.fitness, profile.ageGroup),
    technique: applyAgeModifiers(baseLoad.technique, profile.ageGroup),
  };

  const workout = await buildWorkout({
    userId,
    goal: day.goal,
    energyState: day.energyState,
    structure,
    muscleGroups,
    loadTypes,
    rpeRange,
    complexityLevels: allowedComplexityLevels,
    ageGroup: profile.ageGroup,
  });
  return { ...workout, rpeAvg: Math.round((rpeRange.min + rpeRange.max) / 2) };
}

// ── «Раскисление» по части тела ────────────────────────────────────────────
export type BodyPart = 'lower' | 'upper' | 'full';

export const BODY_PARTS: BodyPart[] = ['lower', 'upper', 'full'];

export const BODY_PART_LABEL: Record<BodyPart, string> = {
  lower: 'Низ тела',
  upper: 'Верх тела',
  full: 'Всё тело',
};

export function isBodyPart(v: unknown): v is BodyPart {
  return v === 'lower' || v === 'upper' || v === 'full';
}

/** Переопределение мышечных групп разминки+заминки для выбранной части тела.
 *  'full' → undefined (без переопределения, как стандартное всё-тело). */
export function stretchMuscleOverride(bodyPart: BodyPart): Partial<ModuleDirections> | undefined {
  if (bodyPart === 'lower') {
    return {
      warmup: [MuscleGroup.LOWER_BODY, MuscleGroup.PREHAB_KNEE],
      cooldown: [MuscleGroup.LOWER_BODY, MuscleGroup.PREHAB_KNEE, MuscleGroup.PREHAB_BACK],
    };
  }
  if (bodyPart === 'upper') {
    return {
      warmup: [MuscleGroup.UPPER_PUSH, MuscleGroup.UPPER_PULL, MuscleGroup.PREHAB_SHOULDER],
      cooldown: [MuscleGroup.PREHAB_SHOULDER, MuscleGroup.PREHAB_BACK, MuscleGroup.UPPER_PUSH, MuscleGroup.UPPER_PULL],
    };
  }
  return undefined;
}
