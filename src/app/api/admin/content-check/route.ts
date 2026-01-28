import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { ModuleType, LoadType, MuscleGroup, TrainingGoal } from '@/generated/prisma';

/**
 * GET /api/admin/content-check
 * Анализирует базу видео и определяет приоритеты для загрузки нового контента
 * Основан на логике генерации тренировок из "Треньки" документа
 */

// Карты соответствия для статусов тренировки
const FITNESS_LOAD_TYPES_BY_STATUS = {
  RECOVERY: [LoadType.MOBILITY, LoadType.STATIC_STRETCH],
  DEVELOPMENT: [
    LoadType.AGILITY,
    LoadType.SPEED,
    LoadType.ANAEROBIC_ENDURANCE,
    LoadType.STRENGTH_ENDURANCE,
  ],
  PEAK: [
    LoadType.POWER,
    LoadType.MAX_STRENGTH,
    LoadType.AEROBIC_ENDURANCE,
    LoadType.TECHNICAL_SKILL,
  ],
};

const TECHNIQUE_COMPATIBLE = {
  [LoadType.AGILITY]: [LoadType.TECHNICAL_SKILL],
  [LoadType.SPEED]: [LoadType.TECHNICAL_SKILL],
  [LoadType.ANAEROBIC_ENDURANCE]: [LoadType.TECHNICAL_SKILL, LoadType.AEROBIC_ENDURANCE],
  [LoadType.POWER]: [LoadType.TECHNICAL_SKILL],
  [LoadType.MOBILITY]: [LoadType.STATIC_STRETCH],
  [LoadType.STRENGTH_ENDURANCE]: [LoadType.TECHNICAL_SKILL],
  [LoadType.MAX_STRENGTH]: [LoadType.TECHNICAL_SKILL],
  [LoadType.AEROBIC_ENDURANCE]: [LoadType.TECHNICAL_SKILL],
  [LoadType.TECHNICAL_SKILL]: [LoadType.AGILITY],
};

const WARMUP_TYPES_BY_STATUS = {
  RECOVERY: [LoadType.STATIC_STRETCH, LoadType.MOBILITY],
  DEVELOPMENT: [LoadType.AGILITY, LoadType.DYNAMIC_STRETCH],
  PEAK: [LoadType.DYNAMIC_STRETCH, LoadType.AGILITY],
};

const COOLDOWN_LOAD_TYPES = [LoadType.STATIC_STRETCH, LoadType.MOBILITY];

// Все возможные мышечные группы
const ALL_MUSCLE_GROUPS = [
  MuscleGroup.FULL_BODY,
  MuscleGroup.UPPER_PULL,
  MuscleGroup.UPPER_PUSH,
  MuscleGroup.LOWER_BODY,
  MuscleGroup.CORE_STABILITY,
  MuscleGroup.CORE_DYNAMICS,
  MuscleGroup.PREHAB_SHOULDER,
  MuscleGroup.PREHAB_KNEE,
  MuscleGroup.PREHAB_BACK,
];

interface GapAnalysis {
  moduleType: ModuleType;
  loadType: LoadType;
  muscleGroup?: MuscleGroup;
  status: TrainingGoal;
  priority: number; // 1-10, где 10 - критично
  reason: string;
  currentCount: number;
  recommendedCount: number;
}

export async function GET(request: NextRequest) {
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
        trainingGoals: true,
      },
    });

    const gaps: GapAnalysis[] = [];

    // === 1. АНАЛИЗ FITNESS (стержневой модуль) - КРИТИЧНО ===
    // Для каждого статуса проверяем покрытие типов нагрузки
    for (const [status, loadTypes] of Object.entries(FITNESS_LOAD_TYPES_BY_STATUS)) {
      for (const loadType of loadTypes) {
        // Проверяем разнообразие мышечных групп
        const relevantVideos = allVideos.filter(
          (v) =>
            v.moduleType === ModuleType.FITNESS &&
            v.loadType === loadType &&
            v.trainingGoals?.includes(status as TrainingGoal)
        );

        const muscleGroupCoverage = new Set(relevantVideos.map((v) => v.muscleGroup));
        const missingMuscleGroups = ALL_MUSCLE_GROUPS.filter(
          (mg) => !muscleGroupCoverage.has(mg)
        );

        // Критично если < 2 видео на тип нагрузки
        if (relevantVideos.length < 2) {
          gaps.push({
            moduleType: ModuleType.FITNESS,
            loadType: loadType,
            status: status as TrainingGoal,
            priority: 10, // Максимальный приоритет
            reason: `КРИТИЧНО: Стержневой модуль. Только ${relevantVideos.length} видео для статуса ${status}`,
            currentCount: relevantVideos.length,
            recommendedCount: 3,
          });
        }

        // Важно иметь разнообразие мышечных групп
        if (missingMuscleGroups.length > 6) {
          gaps.push({
            moduleType: ModuleType.FITNESS,
            loadType: loadType,
            status: status as TrainingGoal,
            priority: 8,
            reason: `Нужно разнообразие: покрыто только ${muscleGroupCoverage.size}/9 мышечных групп`,
            currentCount: muscleGroupCoverage.size,
            recommendedCount: 9,
            muscleGroup: missingMuscleGroups[0], // Первая отсутствующая
          });
        }
      }
    }

    // === 2. АНАЛИЗ WARMUP - ВАЖНО ===
    for (const [status, loadTypes] of Object.entries(WARMUP_TYPES_BY_STATUS)) {
      for (const loadType of loadTypes) {
        // Для разминки критично покрытие FULL_BODY
        const fullBodyWarmups = allVideos.filter(
          (v) =>
            v.moduleType === ModuleType.WARMUP &&
            v.loadType === loadType &&
            v.muscleGroup === MuscleGroup.FULL_BODY &&
            v.trainingGoals?.includes(status as TrainingGoal)
        );

        if (fullBodyWarmups.length === 0) {
          gaps.push({
            moduleType: ModuleType.WARMUP,
            loadType: loadType,
            muscleGroup: MuscleGroup.FULL_BODY,
            status: status as TrainingGoal,
            priority: 9,
            reason: `ВАЖНО: Нет разминки ${loadType} для всего тела (статус ${status})`,
            currentCount: 0,
            recommendedCount: 2,
          });
        }

        // Также проверяем другие группы
        const otherWarmups = allVideos.filter(
          (v) =>
            v.moduleType === ModuleType.WARMUP &&
            v.loadType === loadType &&
            v.muscleGroup !== MuscleGroup.FULL_BODY
        );

        if (otherWarmups.length < 2) {
          gaps.push({
            moduleType: ModuleType.WARMUP,
            loadType: loadType,
            status: status as TrainingGoal,
            priority: 7,
            reason: `Мало вариантов разминки ${loadType} для отдельных групп мышц`,
            currentCount: otherWarmups.length,
            recommendedCount: 3,
          });
        }
      }
    }

    // === 3. АНАЛИЗ COOLDOWN - ВАЖНО ===
    for (const loadType of COOLDOWN_LOAD_TYPES) {
      // Проверяем покрытие FULL_BODY
      const fullBodyCooldowns = allVideos.filter(
        (v) =>
          v.moduleType === ModuleType.COOLDOWN &&
          v.loadType === loadType &&
          v.muscleGroup === MuscleGroup.FULL_BODY
      );

      if (fullBodyCooldowns.length === 0) {
        gaps.push({
          moduleType: ModuleType.COOLDOWN,
          loadType: loadType,
          muscleGroup: MuscleGroup.FULL_BODY,
          status: TrainingGoal.SPORT_LONGEVITY, // Заминка связана с восстановлением
          priority: 9,
          reason: `ВАЖНО: Нет заминки ${loadType} для всего тела`,
          currentCount: 0,
          recommendedCount: 2,
        });
      }

      // Другие группы мышц
      const otherCooldowns = allVideos.filter(
        (v) =>
          v.moduleType === ModuleType.COOLDOWN &&
          v.loadType === loadType &&
          v.muscleGroup !== MuscleGroup.FULL_BODY
      );

      if (otherCooldowns.length < 2) {
        gaps.push({
          moduleType: ModuleType.COOLDOWN,
          loadType: loadType,
          status: TrainingGoal.SPORT_LONGEVITY,
          priority: 6,
          reason: `Мало вариантов заминки ${loadType} для отдельных групп`,
          currentCount: otherCooldowns.length,
          recommendedCount: 3,
        });
      }
    }

    // === 4. АНАЛИЗ TECHNIQUE - ЖЕЛАТЕЛЬНО ===
    // Проверяем совместимость с FITNESS типами
    for (const [fitnessLoadType, compatibleTypes] of Object.entries(TECHNIQUE_COMPATIBLE)) {
      for (const techniqueType of compatibleTypes) {
        const techniqueVideos = allVideos.filter(
          (v) => v.moduleType === ModuleType.TECHNIQUE && v.loadType === techniqueType
        );

        if (techniqueVideos.length < 2) {
          gaps.push({
            moduleType: ModuleType.TECHNIQUE,
            loadType: techniqueType as LoadType,
            status: TrainingGoal.SOFT_HANDS,
            priority: 5,
            reason: `Совместимо с FITNESS ${fitnessLoadType}. Добавит разнообразие.`,
            currentCount: techniqueVideos.length,
            recommendedCount: 3,
          });
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
      criticalGaps: gaps.filter((g) => g.priority >= 9).length,
      importantGaps: gaps.filter((g) => g.priority >= 7 && g.priority < 9).length,
      desirableGaps: gaps.filter((g) => g.priority < 7).length,
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
