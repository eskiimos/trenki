/**
 * СИСТЕМА ПОДБОРА МОДУЛЕЙ С ФОЛБЭКАМИ
 * 
 * Реализует 5-уровневую систему приоритетов (п.12):
 * 1. Идеальное совпадение (все теги)
 * 2. Без учета типа нагрузки
 * 3. Без учета возраста  
 * 4. Без учета RPE
 * 5. Любое видео нужного модуля
 */

import { prisma } from '@/lib/prisma';
import { 
  ModuleType, 
  LoadType, 
  MuscleGroup, 
  ComplexityLevel, 
  AgeGroup, 
  Video 
} from '@/generated/prisma';
import {
  ModuleSearchCriteria,
  FallbackPriority,
  FALLBACK_PRIORITIES,
  RPERange,
} from './training-algorithm-v3';
// Фильтр по уровню всегда включает «Любой» (ANY): такие видео подбираются
// наравне с видео точного уровня на всех ступенях, а не только на ANY_MODULE.
import { complexityFilterForLevels } from './complexity';

interface VideoWithTrainer extends Video {
  trainer: {
    id: string;
    name: string;
    lastName: string;
    avatar: string | null;
  };
  videoTags: Array<{
    tag: {
      loadType: LoadType | null;
    };
  }>;
}

/**
 * Главная функция подбора модуля с фолбэками
 */
export async function selectModuleWithFallback(
  criteria: ModuleSearchCriteria,
  excludeVideoIds: string[] = []
): Promise<{
  video: VideoWithTrainer | null;
  fallbackLevel: FallbackPriority | null;
  attempts: number;
}> {
  let attempts = 0;

  // Проходим по всем уровням приоритета
  for (const priority of FALLBACK_PRIORITIES) {
    attempts++;
    console.log(`🔍 Попытка ${attempts}: ${priority}`);

    const video = await searchWithPriority(criteria, priority, excludeVideoIds);

    if (video) {
      console.log(`✅ Найдено на уровне ${priority}:`, video.title);
      return { video, fallbackLevel: priority, attempts };
    }
  }

  console.log(`❌ Модуль ${criteria.moduleType} не найден после ${attempts} попыток`);
  return { video: null, fallbackLevel: null, attempts };
}

/**
 * Поиск с конкретным уровнем приоритета
 */
async function searchWithPriority(
  criteria: ModuleSearchCriteria,
  priority: FallbackPriority,
  excludeVideoIds: string[]
): Promise<VideoWithTrainer | null> {
  const where: any = {
    isPublished: true,
    id: { notIn: excludeVideoIds },
    moduleType: criteria.moduleType,
  };

  // Фильтруем по trainingGoals если указана цель (для разминки и заминки)
  if (criteria.trainingGoal) {
    where.trainingGoals = { has: criteria.trainingGoal };
  }

  // Применяем фильтры в зависимости от уровня приоритета
  switch (priority) {
    case 'PERFECT_MATCH':
      // Все теги совпадают
      where.complexity = { in: complexityFilterForLevels(criteria.complexityLevels) };
      if (criteria.ageGroup) {
        where.ageGroups = { has: criteria.ageGroup };
      }
      if (criteria.muscleGroups.length > 0) {
        where.muscleGroup = { in: criteria.muscleGroups };
      }
      if (criteria.loadTypes.length > 0) {
        where.loadType = { in: criteria.loadTypes };
      }
      where.rpeMin = { lte: criteria.rpeRange.max };
      where.rpeMax = { gte: criteria.rpeRange.min };
      break;

    case 'NO_LOAD_TYPE':
      // Без учета типа нагрузки
      where.complexity = { in: complexityFilterForLevels(criteria.complexityLevels) };
      if (criteria.ageGroup) {
        where.ageGroups = { has: criteria.ageGroup };
      }
      if (criteria.muscleGroups.length > 0) {
        where.muscleGroup = { in: criteria.muscleGroups };
      }
      where.rpeMin = { lte: criteria.rpeRange.max };
      where.rpeMax = { gte: criteria.rpeRange.min };
      break;

    case 'NO_AGE':
      // Без учета возраста
      where.complexity = { in: complexityFilterForLevels(criteria.complexityLevels) };
      if (criteria.muscleGroups.length > 0) {
        where.muscleGroup = { in: criteria.muscleGroups };
      }
      if (criteria.loadTypes.length > 0) {
        where.loadType = { in: criteria.loadTypes };
      }
      where.rpeMin = { lte: criteria.rpeRange.max };
      where.rpeMax = { gte: criteria.rpeRange.min };
      break;

    case 'NO_RPE':
      // Без учета RPE
      where.complexity = { in: complexityFilterForLevels(criteria.complexityLevels) };
      if (criteria.ageGroup) {
        where.ageGroups = { has: criteria.ageGroup };
      }
      if (criteria.muscleGroups.length > 0) {
        where.muscleGroup = { in: criteria.muscleGroups };
      }
      if (criteria.loadTypes.length > 0) {
        where.loadType = { in: criteria.loadTypes };
      }
      break;

    case 'BASIC_MATCH':
      // Минимальные требования: только тип модуля, направление, возраст и уровень
      where.complexity = { in: complexityFilterForLevels(criteria.complexityLevels) };
      if (criteria.ageGroup) {
        where.ageGroups = { has: criteria.ageGroup };
      }
      if (criteria.muscleGroups.length > 0) {
        where.muscleGroup = { in: criteria.muscleGroups };
      }
      break;

    case 'ANY_MODULE':
      // Вообще любое видео нужного типа модуля (для разминки/заминки)
      // Только moduleType и isPublished. Сюда же доходят видео без уровня
      // («Не указано»); «Любой» (ANY) берётся раньше — на всех уровнях выше.
      break;
  }

  // Получаем все подходящие видео для случайного выбора
  const videos = await prisma.video.findMany({
    where,
    include: {
      trainer: {
        select: {
          id: true,
          name: true,
          lastName: true,
          avatar: true,
        },
      },
      videoTags: {
        include: {
          tag: {
            select: {
              loadType: true,
            },
          },
        },
      },
    },
  });

  // Если ничего не найдено, возвращаем null
  if (videos.length === 0) {
    return null;
  }

  // Выбираем случайное видео из найденных
  const randomIndex = Math.floor(Math.random() * videos.length);
  return videos[randomIndex];
}

/**
 * Вспомогательная функция для создания критериев поиска
 */
export function createSearchCriteria(
  moduleType: ModuleType,
  loadTypes: LoadType[],
  muscleGroups: MuscleGroup[],
  complexityLevels: ComplexityLevel[],
  rpeRange: RPERange,
  ageGroup?: AgeGroup,
  trainingGoal?: any // TrainingGoal для фильтрации разминки/заминки
): ModuleSearchCriteria {
  return {
    moduleType,
    loadTypes,
    muscleGroups,
    complexityLevels,
    rpeRange,
    ageGroup,
    trainingGoal,
  };
}
