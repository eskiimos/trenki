/**
 * АЛГОРИТМ ТРЕНЬКИ 2.0
 * 
 * Система матриц соответствия для построения тренировок
 * на основе выбранной цели, состояния, возраста и потенциала
 */

import { 
  TrainingGoal, 
  EnergyState, 
  AgeGroup, 
  ComplexityLevel,
  LoadType, 
  MuscleGroup, 
  ModuleType 
} from '@/generated/prisma';

// ============================================================================
// 1. КОНСТАНТЫ И ТИПЫ
// ============================================================================

export interface ModuleDirections {
  warmup: MuscleGroup[];
  fitness: MuscleGroup[];
  technique: MuscleGroup[];
  cooldown: MuscleGroup[];
}

export interface GoalLoadTypes {
  fitness: LoadType[];
  technique: LoadType[];
}

export interface RPERange {
  min: number;
  max: number;
}

// ============================================================================
// 2. МАТРИЦА: ЦЕЛЬ → НАПРАВЛЕНИЯ НАГРУЗКИ (п.6)
// ============================================================================

export const GOAL_TO_MUSCLE_GROUPS: Record<TrainingGoal, ModuleDirections> = {
  [TrainingGoal.POWERFUL_SHOT]: {
    warmup: [MuscleGroup.UPPER_PUSH, MuscleGroup.UPPER_PULL, MuscleGroup.FULL_BODY, MuscleGroup.CORE_DYNAMICS, MuscleGroup.CORE_STABILITY],
    fitness: [MuscleGroup.UPPER_PUSH, MuscleGroup.UPPER_PULL, MuscleGroup.CORE_DYNAMICS, MuscleGroup.CORE_STABILITY],
    technique: [MuscleGroup.UPPER_PUSH, MuscleGroup.UPPER_PULL],
    cooldown: [MuscleGroup.UPPER_PUSH, MuscleGroup.UPPER_PULL, MuscleGroup.PREHAB_SHOULDER],
  },

  [TrainingGoal.OUTRUN_OPPONENT]: {
    warmup: [MuscleGroup.LOWER_BODY, MuscleGroup.CORE_DYNAMICS],
    fitness: [MuscleGroup.LOWER_BODY, MuscleGroup.CORE_DYNAMICS],
    technique: [MuscleGroup.FULL_BODY],
    cooldown: [MuscleGroup.LOWER_BODY, MuscleGroup.PREHAB_KNEE, MuscleGroup.PREHAB_BACK],
  },

  [TrainingGoal.STRENGTH_STABILITY]: {
    warmup: [MuscleGroup.FULL_BODY, MuscleGroup.UPPER_PUSH, MuscleGroup.UPPER_PULL],
    fitness: [MuscleGroup.FULL_BODY, MuscleGroup.LOWER_BODY, MuscleGroup.CORE_STABILITY, MuscleGroup.UPPER_PUSH, MuscleGroup.UPPER_PULL],
    technique: [MuscleGroup.FULL_BODY, MuscleGroup.UPPER_PUSH, MuscleGroup.UPPER_PULL],
    cooldown: [MuscleGroup.FULL_BODY, MuscleGroup.UPPER_PUSH, MuscleGroup.UPPER_PULL, MuscleGroup.PREHAB_SHOULDER, MuscleGroup.PREHAB_BACK],
  },

  [TrainingGoal.SOFT_HANDS]: {
    warmup: [MuscleGroup.UPPER_PUSH, MuscleGroup.UPPER_PULL, MuscleGroup.FULL_BODY],
    fitness: [MuscleGroup.UPPER_PUSH, MuscleGroup.UPPER_PULL, MuscleGroup.FULL_BODY],
    technique: [MuscleGroup.UPPER_PUSH, MuscleGroup.UPPER_PULL, MuscleGroup.FULL_BODY],
    cooldown: [MuscleGroup.UPPER_PUSH, MuscleGroup.UPPER_PULL, MuscleGroup.PREHAB_SHOULDER],
  },

  [TrainingGoal.FULL_GAME_ENDURANCE]: {
    warmup: [MuscleGroup.FULL_BODY, MuscleGroup.LOWER_BODY],
    fitness: [MuscleGroup.FULL_BODY, MuscleGroup.LOWER_BODY, MuscleGroup.UPPER_PUSH, MuscleGroup.UPPER_PULL],
    technique: [MuscleGroup.FULL_BODY],
    cooldown: [MuscleGroup.FULL_BODY, MuscleGroup.UPPER_PUSH, MuscleGroup.UPPER_PULL, MuscleGroup.PREHAB_SHOULDER, MuscleGroup.PREHAB_KNEE, MuscleGroup.PREHAB_BACK],
  },

  [TrainingGoal.AGILITY]: {
    warmup: [MuscleGroup.LOWER_BODY, MuscleGroup.FULL_BODY, MuscleGroup.CORE_DYNAMICS],
    fitness: [MuscleGroup.LOWER_BODY, MuscleGroup.FULL_BODY, MuscleGroup.CORE_DYNAMICS],
    technique: [MuscleGroup.FULL_BODY, MuscleGroup.UPPER_PUSH, MuscleGroup.UPPER_PULL],
    cooldown: [MuscleGroup.LOWER_BODY, MuscleGroup.FULL_BODY, MuscleGroup.PREHAB_KNEE, MuscleGroup.PREHAB_BACK],
  },

  [TrainingGoal.SPORT_LONGEVITY]: {
    warmup: [MuscleGroup.FULL_BODY, MuscleGroup.LOWER_BODY, MuscleGroup.UPPER_PUSH, MuscleGroup.UPPER_PULL],
    fitness: [MuscleGroup.FULL_BODY, MuscleGroup.LOWER_BODY, MuscleGroup.UPPER_PUSH, MuscleGroup.UPPER_PULL],
    technique: [MuscleGroup.FULL_BODY, MuscleGroup.UPPER_PUSH, MuscleGroup.UPPER_PULL],
    cooldown: [MuscleGroup.PREHAB_SHOULDER, MuscleGroup.PREHAB_KNEE, MuscleGroup.PREHAB_BACK],
  },
};

// ============================================================================
// 3. МАТРИЦА: ЦЕЛЬ → ТИПЫ НАГРУЗКИ (п.7)
// ============================================================================

export const GOAL_TO_LOAD_TYPES: Record<TrainingGoal, GoalLoadTypes> = {
  [TrainingGoal.POWERFUL_SHOT]: {
    fitness: [LoadType.POWER, LoadType.MAX_STRENGTH, LoadType.SPEED],
    technique: [LoadType.POWER, LoadType.MAX_STRENGTH, LoadType.SPEED],
  },

  [TrainingGoal.OUTRUN_OPPONENT]: {
    fitness: [LoadType.SPEED, LoadType.STRENGTH_ENDURANCE, LoadType.ANAEROBIC_ENDURANCE],
    technique: [LoadType.SPEED],
  },

  [TrainingGoal.STRENGTH_STABILITY]: {
    fitness: [LoadType.MAX_STRENGTH, LoadType.POWER, LoadType.AGILITY],
    technique: [LoadType.MAX_STRENGTH, LoadType.AGILITY],
  },

  [TrainingGoal.SOFT_HANDS]: {
    fitness: [LoadType.AGILITY],
    technique: [LoadType.AGILITY, LoadType.SPEED],
  },

  [TrainingGoal.FULL_GAME_ENDURANCE]: {
    fitness: [LoadType.AEROBIC_ENDURANCE, LoadType.ANAEROBIC_ENDURANCE, LoadType.STRENGTH_ENDURANCE],
    technique: [LoadType.AEROBIC_ENDURANCE],
  },

  [TrainingGoal.AGILITY]: {
    fitness: [LoadType.POWER, LoadType.SPEED],
    technique: [LoadType.SPEED, LoadType.AGILITY],
  },

  [TrainingGoal.SPORT_LONGEVITY]: {
    fitness: [LoadType.MAX_STRENGTH, LoadType.MOBILITY, LoadType.AEROBIC_ENDURANCE],
    technique: [LoadType.AGILITY],
  },
};

// ============================================================================
// 4. МАТРИЦА: RPE НА ОСНОВЕ СОСТОЯНИЯ × ПОТЕНЦИАЛ (п.8)
// ============================================================================

export function getRPERange(
  energyState: EnergyState,
  potential: number,
  ageGroup?: AgeGroup
): RPERange {
  // Определяем уровень сложности на основе потенциала
  const complexityLevel = getComplexityLevel(potential);

  let rpeRange: RPERange;

  // Матрица RPE
  switch (complexityLevel) {
    case ComplexityLevel.BEGINNER:
      rpeRange = {
        [EnergyState.TIRED]: { min: 1, max: 4 },
        [EnergyState.IN_TONE]: { min: 3, max: 5 },
        [EnergyState.FULLY_CHARGED]: { min: 4, max: 7 },
      }[energyState];
      break;

    case ComplexityLevel.AMATEUR:
      rpeRange = {
        [EnergyState.TIRED]: { min: 1, max: 4 },
        [EnergyState.IN_TONE]: { min: 3, max: 6 },
        [EnergyState.FULLY_CHARGED]: { min: 5, max: 8 },
      }[energyState];
      break;

    case ComplexityLevel.ADVANCED:
      rpeRange = {
        [EnergyState.TIRED]: { min: 1, max: 5 },
        [EnergyState.IN_TONE]: { min: 4, max: 7 },
        [EnergyState.FULLY_CHARGED]: { min: 6, max: 9 },
      }[energyState];
      break;

    case ComplexityLevel.PRO:
      rpeRange = {
        [EnergyState.TIRED]: { min: 1, max: 5 },
        [EnergyState.IN_TONE]: { min: 4, max: 7 },
        [EnergyState.FULLY_CHARGED]: { min: 6, max: 10 },
      }[energyState];
      break;

    default:
      rpeRange = { min: 3, max: 6 };
  }

  // Применяем возрастные модификаторы
  if (ageGroup === AgeGroup.ADULT && rpeRange.max > 8) {
    rpeRange.max = 8; // Взрослые 35+ RPE_макс = 8
  }
  if (ageGroup === AgeGroup.CHILD && rpeRange.max > 7) {
    rpeRange.max = 7; // Дети RPE_макс = 7
  }

  return rpeRange;
}

// ============================================================================
// 5. КОЛИЧЕСТВО МОДУЛЕЙ НА ОСНОВЕ СОСТОЯНИЯ И ПОТЕНЦИАЛА (п.9)
// ============================================================================

export interface WorkoutStructure {
  moduleCount: number; // 2-4
  includeWarmup: boolean;
  includeFitness: boolean;
  includeTechnique: boolean;
  includeCooldown: boolean;
}

export function getWorkoutStructure(
  energyState: EnergyState,
  potential: number
): WorkoutStructure {
  const complexityLevel = getComplexityLevel(potential);
  const isAdvanced = complexityLevel === ComplexityLevel.ADVANCED || complexityLevel === ComplexityLevel.PRO;

  switch (energyState) {
    case EnergyState.TIRED:
      // Всегда 3 модуля: разминка + [ФП ИЛИ техника] + заминка
      return {
        moduleCount: 3,
        includeWarmup: true,
        includeFitness: true, // выбираем случайно между ФП и техникой
        includeTechnique: false,
        includeCooldown: true,
      };

    case EnergyState.IN_TONE:
      if (isAdvanced) {
        // Продвинутый/Профи: 4 модуля
        return {
          moduleCount: 4,
          includeWarmup: true,
          includeFitness: true,
          includeTechnique: true,
          includeCooldown: true,
        };
      } else {
        // Начинающий/Любитель: 3 модуля
        return {
          moduleCount: 3,
          includeWarmup: true,
          includeFitness: true,
          includeTechnique: false,
          includeCooldown: true,
        };
      }

    case EnergyState.FULLY_CHARGED:
      // Всегда 4 модуля
      return {
        moduleCount: 4,
        includeWarmup: true,
        includeFitness: true,
        includeTechnique: true,
        includeCooldown: true,
      };

    default:
      return {
        moduleCount: 3,
        includeWarmup: true,
        includeFitness: true,
        includeTechnique: false,
        includeCooldown: true,
      };
  }
}

// ============================================================================
// 6. ТИП РАЗМИНКИ НА ОСНОВЕ СОСТОЯНИЯ (п.10)
// ============================================================================

export function getWarmupLoadTypes(energyState: EnergyState): LoadType[] {
  switch (energyState) {
    case EnergyState.TIRED:
      return [LoadType.DYNAMIC_STRETCH, LoadType.AEROBIC_ENDURANCE];

    case EnergyState.IN_TONE:
      return [LoadType.DYNAMIC_STRETCH, LoadType.POWER, LoadType.SPEED, LoadType.AEROBIC_ENDURANCE]; // динамическая растяжка, кроссфит или аэробная

    case EnergyState.FULLY_CHARGED:
      return [LoadType.POWER, LoadType.SPEED, LoadType.AEROBIC_ENDURANCE]; // кроссфит-комплекс или интенсивная аэробная

    default:
      return [LoadType.DYNAMIC_STRETCH, LoadType.AEROBIC_ENDURANCE];
  }
}

// ============================================================================
// 7. ВОЗРАСТНЫЕ МОДИФИКАТОРЫ (п.7)
// ============================================================================

export function applyAgeModifiers(
  loadTypes: LoadType[],
  ageGroup?: AgeGroup
): LoadType[] {
  // Взрослые 35+: мощность → заменяем на силу или мобильность
  if (ageGroup === AgeGroup.ADULT && loadTypes.includes(LoadType.POWER)) {
    const modifiedTypes = loadTypes.filter(t => t !== LoadType.POWER);
    modifiedTypes.push(LoadType.MAX_STRENGTH, LoadType.MOBILITY);
    return modifiedTypes;
  }

  return loadTypes;
}

// ============================================================================
// 8. УРОВЕНЬ СЛОЖНОСТИ НА ОСНОВЕ ПОТЕНЦИАЛА
// ============================================================================

export function getComplexityLevel(potential: number): ComplexityLevel {
  if (potential >= 77) return ComplexityLevel.PRO;
  if (potential >= 51) return ComplexityLevel.ADVANCED;
  if (potential >= 30) return ComplexityLevel.AMATEUR;
  return ComplexityLevel.BEGINNER;
}

// ============================================================================
// 9. ФОЛБЭКИ ДЛЯ УРОВНЯ СЛОЖНОСТИ (п.5)
// ============================================================================

export function getAllowedComplexityLevels(
  baseLevel: ComplexityLevel,
  energyState: EnergyState
): ComplexityLevel[] {
  const levels = [baseLevel];

  switch (energyState) {
    case EnergyState.FULLY_CHARGED:
      // Можно дать модуль У+1
      if (baseLevel === ComplexityLevel.BEGINNER) levels.push(ComplexityLevel.AMATEUR);
      else if (baseLevel === ComplexityLevel.AMATEUR) levels.push(ComplexityLevel.ADVANCED);
      else if (baseLevel === ComplexityLevel.ADVANCED) levels.push(ComplexityLevel.PRO);
      break;

    case EnergyState.IN_TONE:
      // Можно У-1 или У+1
      if (baseLevel === ComplexityLevel.AMATEUR) {
        levels.push(ComplexityLevel.BEGINNER, ComplexityLevel.ADVANCED);
      } else if (baseLevel === ComplexityLevel.ADVANCED) {
        levels.push(ComplexityLevel.AMATEUR, ComplexityLevel.PRO);
      } else if (baseLevel === ComplexityLevel.PRO) {
        levels.push(ComplexityLevel.ADVANCED);
      } else if (baseLevel === ComplexityLevel.BEGINNER) {
        levels.push(ComplexityLevel.AMATEUR);
      }
      break;

    case EnergyState.TIRED:
      // Можно У-1
      if (baseLevel === ComplexityLevel.AMATEUR) levels.push(ComplexityLevel.BEGINNER);
      else if (baseLevel === ComplexityLevel.ADVANCED) levels.push(ComplexityLevel.AMATEUR);
      else if (baseLevel === ComplexityLevel.PRO) levels.push(ComplexityLevel.ADVANCED);
      break;
  }

  return levels;
}

// ============================================================================
// 10. СИСТЕМА ФОЛБЭКОВ ПРИ ПОДБОРЕ МОДУЛЯ (п.12)
// ============================================================================

export interface ModuleSearchCriteria {
  moduleType: ModuleType;
  loadTypes: LoadType[];
  muscleGroups: MuscleGroup[];
  ageGroup?: AgeGroup;
  complexityLevels: ComplexityLevel[];
  rpeRange: RPERange;
  trainingGoal?: TrainingGoal; // Цель пользователя для фильтрации по trainingGoals видео (для разминки/заминки)
}

/**
 * Приоритеты поиска модуля (от идеального к фолбэкам):
 * 1. Идеальное совпадение (все теги)
 * 2. Без учета типа нагрузки
 * 3. Без учета возраста
 * 4. Без учета RPE
 * 5. Любое видео нужного модуля для возраста, направления и уровня
 * 6. Вообще любое видео нужного модуля (для разминки/заминки)
 */
export const FALLBACK_PRIORITIES = [
  'PERFECT_MATCH',      // все теги совпадают
  'NO_LOAD_TYPE',       // без типа нагрузки
  'NO_AGE',             // без учета возраста
  'NO_RPE',             // без учета RPE
  'BASIC_MATCH',        // минимальные требования
  'ANY_MODULE',         // вообще любое видео нужного типа
] as const;

export type FallbackPriority = typeof FALLBACK_PRIORITIES[number];

// ============================================================================
// 11. СООТВЕТСТВИЕ НАПРАВЛЕНИЙ МЕЖДУ РАЗМИНКОЙ И ФП (п.6 - важно!)
// ============================================================================

/**
 * Стараемся придерживаться соответствия направлений:
 * Все тело (в разминке) = все тело (в ФП)
 * Низ тела = низ тела, верх тела = верх тела, кор = кор динамика/стабилизация
 * 
 * ФОЛБЭК: ЕСЛИ нет подходящего видео, ТО используем ВСЕ ТЕЛО
 */
export function matchWarmupToFitness(fitnessMuscleGroup: MuscleGroup): MuscleGroup[] {
  const mapping: Partial<Record<MuscleGroup, MuscleGroup[]>> = {
    [MuscleGroup.FULL_BODY]: [MuscleGroup.FULL_BODY],
    [MuscleGroup.LOWER_BODY]: [MuscleGroup.LOWER_BODY],
    [MuscleGroup.UPPER_PUSH]: [MuscleGroup.UPPER_PUSH],
    [MuscleGroup.UPPER_PULL]: [MuscleGroup.UPPER_PULL],
    [MuscleGroup.CORE_DYNAMICS]: [MuscleGroup.CORE_DYNAMICS, MuscleGroup.CORE_STABILITY],
    [MuscleGroup.CORE_STABILITY]: [MuscleGroup.CORE_DYNAMICS, MuscleGroup.CORE_STABILITY],
  };

  // Возвращаем соответствие или фолбэк на все тело
  return mapping[fitnessMuscleGroup] || [MuscleGroup.FULL_BODY];
}

// ============================================================================
// 12. ЛОКАЛИЗАЦИЯ ЦЕЛЕЙ ДЛЯ UI
// ============================================================================

export const GOAL_LABELS: Record<string, { emoji: string; label: string; description: string }> = {
  'POWERFUL_SHOT': {
    emoji: '🎯',
    label: 'Мощный бросок',
    description: 'Развитие силы и мощности броска',
  },
  'OUTRUN_OPPONENT': {
    emoji: '🦵🏻',
    label: 'Убегаем от соперника',
    description: 'Развитие скорости и выносливости ног',
  },
  'STRENGTH_STABILITY': {
    emoji: '💪🏻',
    label: 'Силовая борьба и устойчивость',
    description: 'Развитие силы и стабильности в единоборствах',
  },
  'SOFT_HANDS': {
    emoji: '🏒',
    label: 'Мягкие ручки',
    description: 'Развитие ловкости и техники владения клюшкой',
  },
  'FULL_GAME_ENDURANCE': {
    emoji: '🫁',
    label: 'Выносливость на всю игру',
    description: 'Развитие общей и специальной выносливости',
  },
  'AGILITY': {
    emoji: '⚡️',
    label: 'Маневренность',
    description: 'Развитие ловкости и координации',
  },
  'SPORT_LONGEVITY': {
    emoji: '🏥',
    label: 'Спортивное долголетие',
    description: 'Профилактика травм и мобильность',
  },
};

export const ENERGY_STATE_LABELS: Record<string, { emoji: string; label: string }> = {
  'FULLY_CHARGED': {
    emoji: '🔋',
    label: 'Заряжен на все 100%',
  },
  'IN_TONE': {
    emoji: '⚡️',
    label: 'В тонусе, но не супер',
  },
  'TIRED': {
    emoji: '😴',
    label: 'Устал / восстанавливаюсь',
  },
};
