import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  ModuleType,
  LoadType,
  MuscleGroup,
  TrainingGoal,
  AgeGroup,
  Complexity,
  EnergyState,
} from '@/generated/prisma';
import {
  GOAL_TO_MUSCLE_GROUPS,
  GOAL_TO_LOAD_TYPES,
  applyAgeModifiers,
  getRPERange,
} from '@/lib/training-algorithm-v3';

import { requireAdminAsync } from '@/lib/admin-session';
import { priorityTier } from '@/lib/content-check-priority';

/**
 * GET /api/admin/content-check
 * Анализирует базу видео и определяет приоритеты для загрузки нового контента
 * Актуально для алгоритма 2.0 (цель/состояние/возраст/сложность/RPE)
 */

const AGE_GROUPS: AgeGroup[] = [
  AgeGroup.CHILD,
  AgeGroup.TEEN,
  AgeGroup.YOUNG_ADULT,
  AgeGroup.ADULT,
];

const COMPLEXITIES: Complexity[] = [
  Complexity.BEGINNER,
  Complexity.AMATEUR,
  Complexity.ADVANCED,
  Complexity.PRO,
];

const ENERGY_STATES: EnergyState[] = [
  EnergyState.TIRED,
  EnergyState.IN_TONE,
  EnergyState.FULLY_CHARGED,
];

const COOLDOWN_LOAD_TYPES: LoadType[] = [
  LoadType.STATIC_STRETCH,
  LoadType.MOBILITY,
  LoadType.PREHAB,
];

const MODULE_BASE_PRIORITY: Record<ModuleType, number> = {
  [ModuleType.FITNESS]: 10,
  [ModuleType.WARMUP]: 8,
  [ModuleType.COOLDOWN]: 8,
  [ModuleType.TECHNIQUE]: 6,
};

const MODULE_RECOMMENDED_COUNT: Record<ModuleType, number> = {
  [ModuleType.FITNESS]: 3,
  [ModuleType.WARMUP]: 2,
  [ModuleType.COOLDOWN]: 2,
  [ModuleType.TECHNIQUE]: 2,
};

const POTENTIAL_BY_COMPLEXITY: Record<Complexity, number> = {
  [Complexity.BEGINNER]: 20,
  [Complexity.AMATEUR]: 40,
  [Complexity.ADVANCED]: 60,
  [Complexity.PRO]: 85,
};

interface GapAnalysis {
  goal: TrainingGoal;
  moduleType: ModuleType;
  loadType: LoadType;
  muscleGroup?: MuscleGroup;
  ageGroup?: AgeGroup;
  complexity?: Complexity;
  energyState?: EnergyState;
  priority: number; // 1-10, где 10 - критично
  reason: string;
  currentCount: number;
  recommendedCount: number;
}

export async function GET(request: NextRequest) {
  const denied = await requireAdminAsync(request);
  if (denied) return denied;
  try {
    // Получаем все видео
    const allVideos = await prisma.video.findMany({
      where: { isPublished: true },
      select: {
        id: true,
        title: true,
        moduleType: true,
        loadType: true,
        muscleGroup: true,
        complexity: true,
        ageGroups: true,
        rpeMin: true,
        rpeMax: true,
        trainingGoals: true,
      },
    });

    const gaps: GapAnalysis[] = [];

    const goals = Object.values(TrainingGoal) as TrainingGoal[];

    const countByCriteria = (criteria: {
      moduleType: ModuleType;
      loadType: LoadType;
      muscleGroup: MuscleGroup;
      goal: TrainingGoal;
      ageGroup?: AgeGroup;
      complexity?: Complexity;
      rpeRange?: { min: number; max: number };
    }) =>
      allVideos.filter((video) => {
        if (video.moduleType !== criteria.moduleType) return false;
        if (video.loadType !== criteria.loadType) return false;
        if (video.muscleGroup !== criteria.muscleGroup) return false;
        if (!video.trainingGoals?.includes(criteria.goal)) return false;
        if (criteria.ageGroup && !video.ageGroups?.includes(criteria.ageGroup)) return false;
        if (criteria.complexity && video.complexity !== criteria.complexity) return false;
        if (criteria.rpeRange) {
          if (video.rpeMin == null || video.rpeMax == null) return false;
          if (video.rpeMin > criteria.rpeRange.max) return false;
          if (video.rpeMax < criteria.rpeRange.min) return false;
        }
        return true;
      }).length;

    for (const goal of goals) {
      const goalMuscleGroups = GOAL_TO_MUSCLE_GROUPS[goal];
      const goalLoadTypes = GOAL_TO_LOAD_TYPES[goal];

      const moduleConfig: Array<{
        moduleType: ModuleType;
        loadTypes: LoadType[];
        muscleGroups: MuscleGroup[];
      }> = [
        {
          moduleType: ModuleType.FITNESS,
          loadTypes: goalLoadTypes.fitness,
          muscleGroups: goalMuscleGroups.fitness,
        },
        {
          moduleType: ModuleType.TECHNIQUE,
          loadTypes: goalLoadTypes.technique,
          muscleGroups: goalMuscleGroups.technique,
        },
        {
          moduleType: ModuleType.WARMUP,
          loadTypes: [LoadType.DYNAMIC_STRETCH, LoadType.POWER, LoadType.SPEED],
          muscleGroups: goalMuscleGroups.warmup,
        },
        {
          moduleType: ModuleType.COOLDOWN,
          loadTypes: COOLDOWN_LOAD_TYPES,
          muscleGroups: goalMuscleGroups.cooldown,
        },
      ];

      for (const moduleRule of moduleConfig) {
        for (const loadType of moduleRule.loadTypes) {
          for (const muscleGroup of moduleRule.muscleGroups) {
            const basePriority = MODULE_BASE_PRIORITY[moduleRule.moduleType];
            const recommendedCount = MODULE_RECOMMENDED_COUNT[moduleRule.moduleType];

            const coreCount = countByCriteria({
              moduleType: moduleRule.moduleType,
              loadType,
              muscleGroup,
              goal,
            });

            if (coreCount < 1) {
              gaps.push({
                goal,
                moduleType: moduleRule.moduleType,
                loadType,
                muscleGroup,
                priority: basePriority,
                reason: `Нет базового покрытия для цели ${goal}`,
                currentCount: coreCount,
                recommendedCount,
              });
              continue;
            }

            if (coreCount < recommendedCount) {
              gaps.push({
                goal,
                moduleType: moduleRule.moduleType,
                loadType,
                muscleGroup,
                priority: Math.max(basePriority - 1, 4),
                reason: `Недостаточно контента для устойчивого подбора`,
                currentCount: coreCount,
                recommendedCount,
              });
            }

            for (const ageGroup of AGE_GROUPS) {
              const adjustedLoadTypes = applyAgeModifiers([loadType], ageGroup);
              if (!adjustedLoadTypes.includes(loadType)) {
                continue;
              }

              const ageCount = countByCriteria({
                moduleType: moduleRule.moduleType,
                loadType,
                muscleGroup,
                goal,
                ageGroup,
              });

              if (ageCount === 0) {
                gaps.push({
                  goal,
                  moduleType: moduleRule.moduleType,
                  loadType,
                  muscleGroup,
                  ageGroup,
                  priority: Math.max(basePriority - 2, 4),
                  reason: `Нет контента для возраста ${ageGroup}`,
                  currentCount: ageCount,
                  recommendedCount,
                });
              }

              for (const complexity of COMPLEXITIES) {
                const complexityCount = countByCriteria({
                  moduleType: moduleRule.moduleType,
                  loadType,
                  muscleGroup,
                  goal,
                  ageGroup,
                  complexity,
                });

                if (complexityCount === 0) {
                  gaps.push({
                    goal,
                    moduleType: moduleRule.moduleType,
                    loadType,
                    muscleGroup,
                    ageGroup,
                    complexity,
                    priority: Math.max(basePriority - 3, 3),
                    reason: `Нет контента по сложности ${complexity}`,
                    currentCount: complexityCount,
                    recommendedCount,
                  });
                }

                for (const energyState of ENERGY_STATES) {
                  const rpeRange = getRPERange(
                    energyState,
                    POTENTIAL_BY_COMPLEXITY[complexity],
                    ageGroup
                  );

                  const rpeCount = countByCriteria({
                    moduleType: moduleRule.moduleType,
                    loadType,
                    muscleGroup,
                    goal,
                    ageGroup,
                    complexity,
                    rpeRange,
                  });

                  if (rpeCount === 0) {
                    gaps.push({
                      goal,
                      moduleType: moduleRule.moduleType,
                      loadType,
                      muscleGroup,
                      ageGroup,
                      complexity,
                      energyState,
                      priority: Math.max(basePriority - 4, 2),
                      reason: `Нет RPE-диапазона для состояния ${energyState}`,
                      currentCount: rpeCount,
                      recommendedCount,
                    });
                  }
                }
              }
            }
          }
        }
      }
    }

    // Сортируем по приоритету (от большего к меньшему)
    gaps.sort((a, b) => b.priority - a.priority);

    // Топ-15 самых важных
    const topPriorities = gaps.slice(0, 15);

    // Статистика по текущей базе
    const stats = {
      total: allVideos.length,
      byModule: {
        FITNESS: allVideos.filter((v) => v.moduleType === ModuleType.FITNESS).length,
        WARMUP: allVideos.filter((v) => v.moduleType === ModuleType.WARMUP).length,
        COOLDOWN: allVideos.filter((v) => v.moduleType === ModuleType.COOLDOWN).length,
        TECHNIQUE: allVideos.filter((v) => v.moduleType === ModuleType.TECHNIQUE).length,
      },
      byGoal: goals.reduce((acc, goal) => {
        acc[goal] = allVideos.filter((v) => v.trainingGoals?.includes(goal)).length;
        return acc;
      }, {} as Record<TrainingGoal, number>),
      byAgeGroup: AGE_GROUPS.reduce((acc, group) => {
        acc[group] = allVideos.filter((v) => v.ageGroups?.includes(group)).length;
        return acc;
      }, {} as Record<AgeGroup, number>),
      byComplexity: COMPLEXITIES.reduce((acc, complexity) => {
        acc[complexity] = allVideos.filter((v) => v.complexity === complexity).length;
        return acc;
      }, {} as Record<Complexity, number>),
      metaQuality: {
        missingModuleType: allVideos.filter((v) => !v.moduleType).length,
        missingLoadType: allVideos.filter((v) => !v.loadType).length,
        missingMuscleGroup: allVideos.filter((v) => !v.muscleGroup).length,
        missingComplexity: allVideos.filter((v) => !v.complexity).length,
        missingRpe: allVideos.filter((v) => v.rpeMin == null || v.rpeMax == null).length,
        missingAgeGroups: allVideos.filter((v) => !v.ageGroups || v.ageGroups.length === 0).length,
        missingTrainingGoals: allVideos.filter((v) => !v.trainingGoals || v.trainingGoals.length === 0).length,
      },
      fullyTagged: allVideos.filter((v) =>
        v.moduleType &&
        v.loadType &&
        v.muscleGroup &&
        v.complexity &&
        v.rpeMin != null &&
        v.rpeMax != null &&
        v.ageGroups && v.ageGroups.length > 0 &&
        v.trainingGoals && v.trainingGoals.length > 0
      ).length,
      criticalGaps: gaps.filter((g) => priorityTier(g.priority) === 'critical').length,
      importantGaps: gaps.filter((g) => priorityTier(g.priority) === 'important').length,
      desirableGaps: gaps.filter((g) => priorityTier(g.priority) === 'desirable').length,
    };

    return NextResponse.json({
      success: true,
      stats,
      topPriorities,
      allGaps: gaps,
    });
  } catch (error) {
    console.error('Error analyzing content gaps:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
