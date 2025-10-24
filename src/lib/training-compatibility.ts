/**
 * Таблицы совместимости модулей тренировки
 * На основе документа "Алгоритм «Треньки»" (п. 7-11)
 */

import { LoadType, MuscleGroup, ModuleType } from '@/generated/prisma';

/**
 * П.7 - Совместимость типа нагрузки с направлением нагрузки
 */
export const LOAD_TYPE_MUSCLE_COMPATIBILITY: Record<LoadType, MuscleGroup[]> = {
  // Физ подготовка
  [LoadType.MAX_STRENGTH]: [
    MuscleGroup.FULL_BODY,
    MuscleGroup.LOWER_BODY,
    MuscleGroup.UPPER_PUSH,
    MuscleGroup.UPPER_PULL,
    MuscleGroup.CORE_STABILITY,
  ],
  [LoadType.SPEED]: [
    MuscleGroup.LOWER_BODY,
    MuscleGroup.UPPER_PUSH,
    MuscleGroup.CORE_DYNAMICS,
  ],
  [LoadType.STRENGTH_ENDURANCE]: [
    MuscleGroup.FULL_BODY,
    MuscleGroup.LOWER_BODY,
    MuscleGroup.UPPER_PUSH,
    MuscleGroup.UPPER_PULL,
    MuscleGroup.CORE_STABILITY,
    MuscleGroup.CORE_DYNAMICS,
  ],
  [LoadType.ANAEROBIC_ENDURANCE]: [
    MuscleGroup.FULL_BODY,
    MuscleGroup.LOWER_BODY,
    MuscleGroup.UPPER_PUSH,
    MuscleGroup.UPPER_PULL,
    MuscleGroup.CORE_STABILITY,
    MuscleGroup.CORE_DYNAMICS,
  ],
  [LoadType.AEROBIC_ENDURANCE]: [
    MuscleGroup.FULL_BODY,
    MuscleGroup.LOWER_BODY,
    MuscleGroup.UPPER_PUSH,
    MuscleGroup.UPPER_PULL,
    MuscleGroup.CORE_STABILITY,
    MuscleGroup.CORE_DYNAMICS,
  ],
  [LoadType.AGILITY]: [
    MuscleGroup.FULL_BODY,
    MuscleGroup.LOWER_BODY,
  ],
  [LoadType.POWER]: [
    MuscleGroup.FULL_BODY,
    MuscleGroup.LOWER_BODY,
    MuscleGroup.UPPER_PUSH,
    MuscleGroup.UPPER_PULL,
    MuscleGroup.CORE_DYNAMICS,
  ],
  [LoadType.MOBILITY]: [
    MuscleGroup.PREHAB_SHOULDER,
    MuscleGroup.PREHAB_KNEE,
    MuscleGroup.PREHAB_BACK,
  ],
  [LoadType.PREHAB]: [
    MuscleGroup.PREHAB_SHOULDER,
    MuscleGroup.PREHAB_KNEE,
    MuscleGroup.PREHAB_BACK,
  ],
  
  // Техника
  [LoadType.TECHNICAL_SKILL]: [
    MuscleGroup.FULL_BODY,
    MuscleGroup.UPPER_PUSH,
    MuscleGroup.UPPER_PULL,
  ],
  
  // Растяжка
  [LoadType.STATIC_STRETCH]: [
    MuscleGroup.FULL_BODY,
    MuscleGroup.LOWER_BODY,
    MuscleGroup.UPPER_PUSH,
    MuscleGroup.UPPER_PULL,
  ],
  [LoadType.DYNAMIC_STRETCH]: [
    MuscleGroup.FULL_BODY,
    MuscleGroup.LOWER_BODY,
    MuscleGroup.UPPER_PUSH,
    MuscleGroup.UPPER_PULL,
  ],
};

/**
 * П.8 - Совместимость модуля TECHNIQUE с модулем FITNESS
 */
export const FITNESS_TECHNIQUE_COMPATIBILITY: Record<LoadType, LoadType[]> = {
  [LoadType.MAX_STRENGTH]: [LoadType.POWER], // Техника + мощность
  [LoadType.SPEED]: [LoadType.AGILITY], // Техника + ловкость
  [LoadType.STRENGTH_ENDURANCE]: [LoadType.SPEED, LoadType.AGILITY, LoadType.POWER],
  [LoadType.ANAEROBIC_ENDURANCE]: [LoadType.SPEED, LoadType.AGILITY, LoadType.POWER],
  [LoadType.AEROBIC_ENDURANCE]: [LoadType.SPEED, LoadType.AGILITY, LoadType.POWER],
  [LoadType.POWER]: [LoadType.SPEED, LoadType.AGILITY],
  [LoadType.AGILITY]: [LoadType.STRENGTH_ENDURANCE, LoadType.SPEED, LoadType.POWER],
  [LoadType.MOBILITY]: [LoadType.AGILITY], // новичок/любитель
  [LoadType.PREHAB]: [LoadType.TECHNICAL_SKILL], // или еще ЛФК
  [LoadType.TECHNICAL_SKILL]: [],
  [LoadType.STATIC_STRETCH]: [],
  [LoadType.DYNAMIC_STRETCH]: [],
};

/**
 * П.9-10 - Совместимость модуля WARMUP с модулем FITNESS
 * Зависит от статуса готовности
 */
export function getWarmupTypes(
  trainingStatus: 'RECOVERY' | 'DEVELOPMENT' | 'PEAK',
  fitnessLoadType?: LoadType
): LoadType[] {
  // Восстановление: только динамическая растяжка
  if (trainingStatus === 'RECOVERY') {
    return [LoadType.DYNAMIC_STRETCH];
  }

  // Пик: только кроссфит комплекс
  if (trainingStatus === 'PEAK') {
    return [LoadType.POWER, LoadType.SPEED]; // кроссфит = power/speed
  }

  // Развитие: зависит от физ подготовки
  if (!fitnessLoadType) {
    return [LoadType.DYNAMIC_STRETCH, LoadType.POWER];
  }

  // При мощность/скорость/сила -> кроссфит
  const powerTypes: LoadType[] = [LoadType.POWER, LoadType.SPEED, LoadType.MAX_STRENGTH];
  if (powerTypes.includes(fitnessLoadType)) {
    return [LoadType.POWER, LoadType.SPEED];
  }

  // При выносливость/ловкость/мобильность/ЛФК -> дин растяжка
  return [LoadType.DYNAMIC_STRETCH];
}

/**
 * П.10 - Совместимость направления разминки с физ подготовкой
 */
export function getWarmupMuscleGroups(fitnessMuscleGroup?: MuscleGroup): MuscleGroup[] {
  if (!fitnessMuscleGroup) {
    return [MuscleGroup.FULL_BODY];
  }

  const compatibility: Record<MuscleGroup, MuscleGroup[]> = {
    [MuscleGroup.FULL_BODY]: [MuscleGroup.FULL_BODY],
    [MuscleGroup.LOWER_BODY]: [MuscleGroup.FULL_BODY, MuscleGroup.LOWER_BODY],
    [MuscleGroup.UPPER_PUSH]: [MuscleGroup.UPPER_PUSH, MuscleGroup.FULL_BODY],
    [MuscleGroup.UPPER_PULL]: [MuscleGroup.UPPER_PULL, MuscleGroup.FULL_BODY],
    [MuscleGroup.CORE_STABILITY]: [MuscleGroup.FULL_BODY],
    [MuscleGroup.CORE_DYNAMICS]: [MuscleGroup.FULL_BODY],
    [MuscleGroup.PREHAB_KNEE]: [MuscleGroup.LOWER_BODY, MuscleGroup.FULL_BODY],
    [MuscleGroup.PREHAB_SHOULDER]: [MuscleGroup.FULL_BODY],
    [MuscleGroup.PREHAB_BACK]: [MuscleGroup.FULL_BODY],
  };

  return compatibility[fitnessMuscleGroup] || [MuscleGroup.FULL_BODY];
}

/**
 * П.11 - Совместимость модуля COOLDOWN с модулем FITNESS
 */
export function getCooldownMuscleGroups(fitnessMuscleGroup?: MuscleGroup): MuscleGroup[] {
  if (!fitnessMuscleGroup) {
    return [MuscleGroup.FULL_BODY];
  }

  const compatibility: Record<MuscleGroup, MuscleGroup[]> = {
    [MuscleGroup.FULL_BODY]: [MuscleGroup.FULL_BODY, MuscleGroup.PREHAB_BACK],
    [MuscleGroup.LOWER_BODY]: [MuscleGroup.LOWER_BODY, MuscleGroup.FULL_BODY, MuscleGroup.PREHAB_KNEE],
    [MuscleGroup.UPPER_PUSH]: [MuscleGroup.UPPER_PUSH, MuscleGroup.PREHAB_SHOULDER],
    [MuscleGroup.UPPER_PULL]: [MuscleGroup.FULL_BODY, MuscleGroup.UPPER_PULL, MuscleGroup.PREHAB_BACK],
    [MuscleGroup.CORE_STABILITY]: [MuscleGroup.FULL_BODY],
    [MuscleGroup.CORE_DYNAMICS]: [MuscleGroup.FULL_BODY],
    [MuscleGroup.PREHAB_KNEE]: [MuscleGroup.LOWER_BODY, MuscleGroup.FULL_BODY],
    [MuscleGroup.PREHAB_SHOULDER]: [MuscleGroup.FULL_BODY, MuscleGroup.UPPER_PUSH, MuscleGroup.UPPER_PULL],
    [MuscleGroup.PREHAB_BACK]: [MuscleGroup.FULL_BODY, MuscleGroup.UPPER_PUSH, MuscleGroup.UPPER_PULL],
  };

  return compatibility[fitnessMuscleGroup] || [MuscleGroup.FULL_BODY];
}

/**
 * П.5 - Доступные типы нагрузки по статусу готовности
 */
export function getAvailableLoadTypes(
  trainingStatus: 'RECOVERY' | 'DEVELOPMENT' | 'PEAK',
  moduleType: ModuleType
): LoadType[] {
  if (trainingStatus === 'RECOVERY') {
    // Восстановление
    const types: Record<ModuleType, LoadType[]> = {
      [ModuleType.WARMUP]: [LoadType.DYNAMIC_STRETCH],
      [ModuleType.FITNESS]: [LoadType.PREHAB, LoadType.MOBILITY],
      [ModuleType.TECHNIQUE]: [LoadType.TECHNICAL_SKILL], // низкая интенсивность
      [ModuleType.COOLDOWN]: [LoadType.STATIC_STRETCH, LoadType.DYNAMIC_STRETCH],
    };
    return types[moduleType] || [];
  }

  if (trainingStatus === 'DEVELOPMENT') {
    // Развитие
    const types: Record<ModuleType, LoadType[]> = {
      [ModuleType.WARMUP]: [LoadType.POWER, LoadType.SPEED, LoadType.DYNAMIC_STRETCH],
      [ModuleType.FITNESS]: [
        LoadType.STRENGTH_ENDURANCE,
        LoadType.ANAEROBIC_ENDURANCE,
        LoadType.AEROBIC_ENDURANCE,
        LoadType.AGILITY,
        LoadType.SPEED,
      ],
      [ModuleType.TECHNIQUE]: [
        LoadType.TECHNICAL_SKILL,
        LoadType.AGILITY,
        LoadType.SPEED,
        LoadType.STRENGTH_ENDURANCE,
      ],
      [ModuleType.COOLDOWN]: [
        LoadType.STATIC_STRETCH,
        LoadType.DYNAMIC_STRETCH,
        LoadType.PREHAB,
      ],
    };
    return types[moduleType] || [];
  }

  // Пик
  const types: Record<ModuleType, LoadType[]> = {
    [ModuleType.WARMUP]: [LoadType.POWER, LoadType.SPEED],
    [ModuleType.FITNESS]: [
      LoadType.MAX_STRENGTH,
      LoadType.SPEED,
      LoadType.ANAEROBIC_ENDURANCE,
      LoadType.POWER,
    ],
    [ModuleType.TECHNIQUE]: [
      LoadType.POWER,
      LoadType.SPEED,
      LoadType.AGILITY,
      LoadType.ANAEROBIC_ENDURANCE,
    ],
    [ModuleType.COOLDOWN]: [
      LoadType.STATIC_STRETCH,
      LoadType.DYNAMIC_STRETCH,
      LoadType.PREHAB,
    ],
  };
  return types[moduleType] || [];
}
