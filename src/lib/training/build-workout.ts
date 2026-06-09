// Сборка тренировки из модулей (РАЗМИНКА → ФП/ТЕХНИКА → ЗАМИНКА).
// Раньше жила inline в src/app/api/training/generate-v3/route.ts. Вынесена в
// общий lib, чтобы её можно было дёргать и из новых эндпоинтов
// (например, /api/microcycle/generate, который генерит 5 сессий подряд).
//
// Поведение не менялось — это чистый extract без рефакторинга логики.

import {
  TrainingGoal,
  EnergyState,
  AgeGroup,
  ModuleType,
  LoadType,
} from '@/generated/prisma';
import {
  getWarmupLoadTypes,
  matchWarmupToFitness,
  type GoalLoadTypes,
  type ModuleDirections,
  type RPERange,
  type WorkoutStructure,
} from '@/lib/training-algorithm-v3';
import {
  selectModuleWithFallback,
  createSearchCriteria,
} from '@/lib/module-selection-v3';

export interface BuildWorkoutParams {
  userId: string;
  goal: TrainingGoal;
  energyState: EnergyState;
  structure: WorkoutStructure;
  muscleGroups: ModuleDirections;
  loadTypes: GoalLoadTypes;
  rpeRange: RPERange;
  complexityLevels: any[];
  ageGroup?: AgeGroup;
}

export interface BuiltModule {
  id: string;
  title: string;
  description: string | null;
  duration: number;
  videoUrl: string;
  thumbnail: string | null;
  muscleGroup: string | null;
  trainer: {
    id: string;
    name: string;
    lastName: string;
    avatar: string;
  };
  moduleType: string;
  loadTypes: string[];
}

export interface BuiltWorkout {
  modules: BuiltModule[];
  totalDuration: number; // в секундах
  missingModules: string[];
}

export async function buildWorkout(params: BuildWorkoutParams): Promise<BuiltWorkout> {
  const {
    goal,
    energyState,
    structure,
    muscleGroups,
    loadTypes,
    rpeRange,
    complexityLevels,
    ageGroup,
  } = params;

  const modules: BuiltModule[] = [];
  let totalDuration = 0;
  const missingModules: string[] = [];
  const excludeVideoIds: string[] = [];

  const selectTechniqueInsteadOfFitness =
    energyState === EnergyState.TIRED && structure.includeFitness && !structure.includeTechnique
      ? Math.random() < 0.5
      : false;

  let selectedWarmup: BuiltModule | null = null;
  let selectedFitness: BuiltModule | null = null;
  let selectedTechnique: BuiltModule | null = null;
  let selectedCooldown: BuiltModule | null = null;

  // ФП ---------------------------------------------------------------
  const shouldSelectFitness = structure.includeFitness && !selectTechniqueInsteadOfFitness;
  const shouldSelectTechnique = structure.includeTechnique || selectTechniqueInsteadOfFitness;

  if (shouldSelectFitness) {
    const fitnessCriteria = createSearchCriteria(
      ModuleType.FITNESS,
      loadTypes.fitness,
      muscleGroups.fitness,
      complexityLevels,
      rpeRange,
      ageGroup,
    );
    const fitnessResult = await selectModuleWithFallback(fitnessCriteria, excludeVideoIds);
    if (fitnessResult.video) {
      selectedFitness = formatModule(fitnessResult.video, 'FITNESS');
      excludeVideoIds.push(fitnessResult.video.id);
      totalDuration += fitnessResult.video.duration;
    } else {
      missingModules.push('ФИЗ ПОДГОТОВКА');
    }
  }

  // Техника ---------------------------------------------------------
  if (shouldSelectTechnique) {
    const techniqueCriteria = createSearchCriteria(
      ModuleType.TECHNIQUE,
      loadTypes.technique,
      muscleGroups.technique,
      complexityLevels,
      rpeRange,
      ageGroup,
    );
    const techniqueResult = await selectModuleWithFallback(techniqueCriteria, excludeVideoIds);
    if (techniqueResult.video) {
      selectedTechnique = formatModule(techniqueResult.video, 'TECHNIQUE');
      excludeVideoIds.push(techniqueResult.video.id);
      totalDuration += techniqueResult.video.duration;
    } else {
      missingModules.push('ТЕХНИКА');
    }
  }

  // Разминка (после ФП — чтобы привязать к мышечной группе) --------
  if (structure.includeWarmup) {
    const warmupLoadTypes = getWarmupLoadTypes(energyState);
    const fitnessMuscleGroup = selectedFitness?.muscleGroup;
    const warmupMuscleGroups = fitnessMuscleGroup
      ? matchWarmupToFitness(fitnessMuscleGroup as any)
      : muscleGroups.warmup;

    const warmupCriteria = createSearchCriteria(
      ModuleType.WARMUP,
      warmupLoadTypes,
      warmupMuscleGroups,
      complexityLevels,
      { min: 1, max: 5 },
      ageGroup,
      goal,
    );
    const warmupResult = await selectModuleWithFallback(warmupCriteria, excludeVideoIds);
    if (warmupResult.video) {
      selectedWarmup = formatModule(warmupResult.video, 'WARMUP');
      excludeVideoIds.push(warmupResult.video.id);
      totalDuration += warmupResult.video.duration;
    } else {
      missingModules.push('РАЗМИНКА');
    }
  }

  // Заминка ---------------------------------------------------------
  if (structure.includeCooldown) {
    const cooldownCriteria = createSearchCriteria(
      ModuleType.COOLDOWN,
      [LoadType.STATIC_STRETCH, LoadType.MOBILITY, LoadType.PREHAB],
      muscleGroups.cooldown,
      complexityLevels,
      { min: 1, max: 4 },
      ageGroup,
      goal,
    );
    const cooldownResult = await selectModuleWithFallback(cooldownCriteria, excludeVideoIds);
    if (cooldownResult.video) {
      selectedCooldown = formatModule(cooldownResult.video, 'COOLDOWN');
      excludeVideoIds.push(cooldownResult.video.id);
      totalDuration += cooldownResult.video.duration;
    } else {
      missingModules.push('ЗАМИНКА');
    }
  }

  if (selectedWarmup) modules.push(selectedWarmup);
  if (selectedFitness) modules.push(selectedFitness);
  if (selectedTechnique) modules.push(selectedTechnique);
  if (selectedCooldown) modules.push(selectedCooldown);

  return {
    modules,
    totalDuration,
    missingModules,
  };
}

function formatModule(video: any, moduleType: string): BuiltModule {
  return {
    id: video.id,
    title: video.title,
    description: video.description,
    duration: video.duration,
    videoUrl: video.videoUrl,
    thumbnail: video.thumbnail,
    muscleGroup: video.muscleGroup || null,
    trainer: {
      id: video.trainer.id,
      name: video.trainer.name,
      lastName: video.trainer.lastName,
      avatar: video.trainer.avatar || '/images/avatars/trainer-avatar-1.png',
    },
    moduleType,
    loadTypes: video.videoTags
      .map((vt: any) => vt.tag.loadType)
      .filter(Boolean),
  };
}
