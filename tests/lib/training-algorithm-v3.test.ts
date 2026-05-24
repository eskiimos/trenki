import { describe, expect, it } from 'vitest';
import {
  AgeGroup,
  ComplexityLevel,
  EnergyState,
  LoadType,
  MuscleGroup,
  TrainingGoal,
} from '@/generated/prisma';
import {
  GOAL_LABELS,
  GOAL_TO_LOAD_TYPES,
  GOAL_TO_MUSCLE_GROUPS,
  applyAgeModifiers,
  getAllowedComplexityLevels,
  getComplexityLevel,
  getRPERange,
  getWarmupLoadTypes,
  getWorkoutStructure,
  matchWarmupToFitness,
} from '@/lib/training-algorithm-v3';

describe('getComplexityLevel', () => {
  it.each([
    [0, ComplexityLevel.BEGINNER],
    [29, ComplexityLevel.BEGINNER],
    [30, ComplexityLevel.AMATEUR],
    [50, ComplexityLevel.AMATEUR],
    [51, ComplexityLevel.ADVANCED],
    [76, ComplexityLevel.ADVANCED],
    [77, ComplexityLevel.PRO],
    [100, ComplexityLevel.PRO],
  ])('potential=%i → %s', (potential, expected) => {
    expect(getComplexityLevel(potential)).toBe(expected);
  });
});

describe('getRPERange', () => {
  it('TIRED + BEGINNER = 1..4', () => {
    expect(getRPERange(EnergyState.TIRED, 10)).toEqual({ min: 1, max: 4 });
  });

  it('IN_TONE + AMATEUR = 3..6', () => {
    expect(getRPERange(EnergyState.IN_TONE, 40)).toEqual({ min: 3, max: 6 });
  });

  it('FULLY_CHARGED + PRO = 6..10', () => {
    expect(getRPERange(EnergyState.FULLY_CHARGED, 90)).toEqual({ min: 6, max: 10 });
  });

  it('ADULT возрастной модификатор зажимает max до 8', () => {
    const r = getRPERange(EnergyState.FULLY_CHARGED, 90, AgeGroup.ADULT);
    expect(r.max).toBe(8);
    expect(r.min).toBe(6);
  });

  it('CHILD возрастной модификатор зажимает max до 7', () => {
    const r = getRPERange(EnergyState.FULLY_CHARGED, 90, AgeGroup.CHILD);
    expect(r.max).toBe(7);
  });

  it('TEEN не получает возрастных скидок', () => {
    expect(getRPERange(EnergyState.FULLY_CHARGED, 90, AgeGroup.TEEN)).toEqual({ min: 6, max: 10 });
  });
});

describe('getWorkoutStructure', () => {
  it('TIRED всегда даёт 3 модуля без техники', () => {
    expect(getWorkoutStructure(EnergyState.TIRED, 80)).toMatchObject({
      moduleCount: 3,
      includeWarmup: true,
      includeFitness: true,
      includeTechnique: false,
      includeCooldown: true,
    });
  });

  it('FULLY_CHARGED всегда даёт 4 модуля', () => {
    expect(getWorkoutStructure(EnergyState.FULLY_CHARGED, 10)).toMatchObject({
      moduleCount: 4,
      includeTechnique: true,
    });
  });

  it('IN_TONE: BEGINNER → 3 модуля', () => {
    expect(getWorkoutStructure(EnergyState.IN_TONE, 10).moduleCount).toBe(3);
  });

  it('IN_TONE: ADVANCED → 4 модуля', () => {
    expect(getWorkoutStructure(EnergyState.IN_TONE, 60).moduleCount).toBe(4);
  });
});

describe('getWarmupLoadTypes', () => {
  it('TIRED — мягкая разминка', () => {
    expect(getWarmupLoadTypes(EnergyState.TIRED)).toEqual([
      LoadType.DYNAMIC_STRETCH,
      LoadType.AEROBIC_ENDURANCE,
    ]);
  });

  it('FULLY_CHARGED — интенсив без растяжки', () => {
    const types = getWarmupLoadTypes(EnergyState.FULLY_CHARGED);
    expect(types).toContain(LoadType.POWER);
    expect(types).toContain(LoadType.SPEED);
    expect(types).not.toContain(LoadType.DYNAMIC_STRETCH);
  });
});

describe('applyAgeModifiers', () => {
  it('ADULT заменяет POWER на MAX_STRENGTH + MOBILITY', () => {
    const result = applyAgeModifiers(
      [LoadType.POWER, LoadType.SPEED],
      AgeGroup.ADULT,
    );
    expect(result).not.toContain(LoadType.POWER);
    expect(result).toContain(LoadType.MAX_STRENGTH);
    expect(result).toContain(LoadType.MOBILITY);
    expect(result).toContain(LoadType.SPEED);
  });

  it('YOUNG_ADULT не модифицирует список', () => {
    const input = [LoadType.POWER, LoadType.SPEED];
    expect(applyAgeModifiers(input, AgeGroup.YOUNG_ADULT)).toEqual(input);
  });

  it('без ageGroup — без модификаций', () => {
    const input = [LoadType.POWER];
    expect(applyAgeModifiers(input)).toEqual(input);
  });
});

describe('getAllowedComplexityLevels', () => {
  it('FULLY_CHARGED разрешает базовый + следующий уровень', () => {
    expect(
      getAllowedComplexityLevels(ComplexityLevel.AMATEUR, EnergyState.FULLY_CHARGED),
    ).toEqual([ComplexityLevel.AMATEUR, ComplexityLevel.ADVANCED]);
  });

  it('FULLY_CHARGED + PRO даёт только PRO (выше нет)', () => {
    expect(
      getAllowedComplexityLevels(ComplexityLevel.PRO, EnergyState.FULLY_CHARGED),
    ).toEqual([ComplexityLevel.PRO]);
  });

  it('IN_TONE даёт ±1 уровень', () => {
    const levels = getAllowedComplexityLevels(ComplexityLevel.ADVANCED, EnergyState.IN_TONE);
    expect(levels).toContain(ComplexityLevel.ADVANCED);
    expect(levels).toContain(ComplexityLevel.AMATEUR);
    expect(levels).toContain(ComplexityLevel.PRO);
  });

  it('TIRED — не выше базового, можно на ступень ниже', () => {
    const levels = getAllowedComplexityLevels(ComplexityLevel.AMATEUR, EnergyState.TIRED);
    expect(levels).toContain(ComplexityLevel.AMATEUR);
    expect(levels).toContain(ComplexityLevel.BEGINNER);
    expect(levels).not.toContain(ComplexityLevel.ADVANCED);
  });

  it('TIRED + BEGINNER → только BEGINNER (ниже некуда)', () => {
    expect(
      getAllowedComplexityLevels(ComplexityLevel.BEGINNER, EnergyState.TIRED),
    ).toEqual([ComplexityLevel.BEGINNER]);
  });
});

describe('matchWarmupToFitness', () => {
  it('CORE_DYNAMICS и CORE_STABILITY взаимозаменяемы', () => {
    expect(matchWarmupToFitness(MuscleGroup.CORE_DYNAMICS)).toEqual(
      expect.arrayContaining([MuscleGroup.CORE_DYNAMICS, MuscleGroup.CORE_STABILITY]),
    );
    expect(matchWarmupToFitness(MuscleGroup.CORE_STABILITY)).toEqual(
      expect.arrayContaining([MuscleGroup.CORE_DYNAMICS, MuscleGroup.CORE_STABILITY]),
    );
  });

  it('LOWER_BODY → только LOWER_BODY', () => {
    expect(matchWarmupToFitness(MuscleGroup.LOWER_BODY)).toEqual([MuscleGroup.LOWER_BODY]);
  });

  it('Неизвестная группа → FULL_BODY как фолбэк', () => {
    expect(matchWarmupToFitness(MuscleGroup.PREHAB_BACK)).toEqual([MuscleGroup.FULL_BODY]);
  });
});

describe('matrix completeness (страховка от рассинхрона)', () => {
  it('Каждая TrainingGoal имеет запись в GOAL_TO_MUSCLE_GROUPS', () => {
    for (const goal of Object.values(TrainingGoal)) {
      expect(GOAL_TO_MUSCLE_GROUPS[goal as TrainingGoal]).toBeDefined();
    }
  });

  it('Каждая TrainingGoal имеет запись в GOAL_TO_LOAD_TYPES', () => {
    for (const goal of Object.values(TrainingGoal)) {
      expect(GOAL_TO_LOAD_TYPES[goal as TrainingGoal]).toBeDefined();
    }
  });

  it('Каждая TrainingGoal имеет UI-локализацию в GOAL_LABELS', () => {
    for (const goal of Object.values(TrainingGoal)) {
      expect(GOAL_LABELS[goal]).toBeDefined();
      expect(GOAL_LABELS[goal].label.length).toBeGreaterThan(0);
    }
  });

  it('У каждой цели в направлениях есть fitness и cooldown (минимум)', () => {
    for (const goal of Object.values(TrainingGoal)) {
      const dirs = GOAL_TO_MUSCLE_GROUPS[goal as TrainingGoal];
      expect(dirs.fitness.length).toBeGreaterThan(0);
      expect(dirs.cooldown.length).toBeGreaterThan(0);
    }
  });
});
