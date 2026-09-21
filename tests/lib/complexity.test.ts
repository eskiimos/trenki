import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AgeGroup,
  Complexity,
  ComplexityLevel,
  EnergyState,
  LoadType,
  ModuleType,
  MuscleGroup,
  TrainingGoal,
} from '@/generated/prisma';
import {
  COMPLEXITY_LABELS,
  complexityFilterForLevels,
  videoFitsComplexity,
  type AthleteComplexity,
} from '@/lib/complexity';
import { getAllowedComplexityLevels } from '@/lib/training-algorithm-v3';

// Подбор ходит в БД через prisma.video.findMany — подменяем его фейком,
// который фильтрует список видео в памяти по тем же полям where, что строит
// module-selection-v3. Так проверяем реальную цепочку фолбэков без БД.
type FakeVideo = {
  id: string;
  title: string;
  isPublished: boolean;
  moduleType: ModuleType;
  complexity: Complexity | null;
  loadType: LoadType | null;
  muscleGroup: MuscleGroup | null;
  ageGroups: AgeGroup[];
  trainingGoals: TrainingGoal[];
  rpeMin: number | null;
  rpeMax: number | null;
};

const store: { videos: FakeVideo[] } = { videos: [] };

function matches(video: FakeVideo, where: any): boolean {
  if (where.isPublished !== undefined && video.isPublished !== where.isPublished) return false;
  if (where.id?.notIn?.includes(video.id)) return false;
  if (where.moduleType && video.moduleType !== where.moduleType) return false;
  if (where.trainingGoals?.has && !video.trainingGoals.includes(where.trainingGoals.has)) return false;
  // Как в Postgres: NULL не входит ни в какой IN (…).
  if (where.complexity?.in && (video.complexity === null || !where.complexity.in.includes(video.complexity))) {
    return false;
  }
  if (where.ageGroups?.has && !video.ageGroups.includes(where.ageGroups.has)) return false;
  if (where.muscleGroup?.in && (video.muscleGroup === null || !where.muscleGroup.in.includes(video.muscleGroup))) {
    return false;
  }
  if (where.loadType?.in && (video.loadType === null || !where.loadType.in.includes(video.loadType))) {
    return false;
  }
  if (where.rpeMin?.lte !== undefined && (video.rpeMin === null || video.rpeMin > where.rpeMin.lte)) return false;
  if (where.rpeMax?.gte !== undefined && (video.rpeMax === null || video.rpeMax < where.rpeMax.gte)) return false;
  return true;
}

vi.mock('@/lib/prisma', () => ({
  prisma: {
    video: {
      findMany: vi.fn(async ({ where }: { where: any }) =>
        store.videos
          .filter((v) => matches(v, where))
          .map((v) => ({
            ...v,
            trainer: { id: 't1', name: 'Тренер', lastName: 'Тестов', avatar: null },
            videoTags: [],
          }))
      ),
    },
  },
}));

// Импорт после vi.mock (vitest поднимает mock наверх, но так нагляднее).
const { selectModuleWithFallback, createSearchCriteria } = await import('@/lib/module-selection-v3');

const ALL_LEVELS: ComplexityLevel[] = [
  ComplexityLevel.BEGINNER,
  ComplexityLevel.AMATEUR,
  ComplexityLevel.ADVANCED,
  ComplexityLevel.PRO,
];

function warmup(id: string, complexity: Complexity | null): FakeVideo {
  return {
    id,
    title: id,
    isPublished: true,
    moduleType: ModuleType.WARMUP,
    complexity,
    loadType: LoadType.DYNAMIC_STRETCH,
    muscleGroup: MuscleGroup.FULL_BODY,
    ageGroups: [AgeGroup.CHILD, AgeGroup.TEEN, AgeGroup.YOUNG_ADULT, AgeGroup.ADULT],
    trainingGoals: [TrainingGoal.POWERFUL_SHOT],
    rpeMin: 2,
    rpeMax: 5,
  };
}

function warmupCriteria(levels: ComplexityLevel[]) {
  return createSearchCriteria(
    ModuleType.WARMUP,
    [LoadType.DYNAMIC_STRETCH],
    [MuscleGroup.FULL_BODY],
    levels,
    { min: 1, max: 5 },
    AgeGroup.TEEN,
    TrainingGoal.POWERFUL_SHOT
  );
}

describe('COMPLEXITY_LABELS', () => {
  it('подписан каждый уровень enum Complexity', () => {
    for (const value of Object.values(Complexity)) {
      expect(COMPLEXITY_LABELS[value]).toBeTruthy();
    }
  });

  it('ANY → «Любой»', () => {
    expect(COMPLEXITY_LABELS[Complexity.ANY]).toBe('Любой');
  });
});

describe('complexityFilterForLevels', () => {
  it('добавляет ANY к уровню атлета', () => {
    expect(complexityFilterForLevels([ComplexityLevel.BEGINNER]).sort()).toEqual(
      [Complexity.ANY, Complexity.BEGINNER].sort()
    );
  });

  it('сохраняет все допустимые уровни и не дублирует', () => {
    const result = complexityFilterForLevels([
      ComplexityLevel.AMATEUR,
      ComplexityLevel.BEGINNER,
      ComplexityLevel.AMATEUR,
    ]);
    expect(result.sort()).toEqual(
      [Complexity.AMATEUR, Complexity.ANY, Complexity.BEGINNER].sort()
    );
  });

  it('ANY есть при любом уровне атлета и любом самочувствии', () => {
    for (const level of ALL_LEVELS) {
      for (const energy of Object.values(EnergyState)) {
        const filter = complexityFilterForLevels(getAllowedComplexityLevels(level, energy));
        expect(filter).toContain(Complexity.ANY);
        expect(filter).toContain(level);
      }
    }
  });

  it('без уровней — только ANY (универсальное видео подходит всем)', () => {
    expect(complexityFilterForLevels([])).toEqual([Complexity.ANY]);
  });

  it('не пропускает NULL («Не указано» ≠ «Любой»)', () => {
    expect(complexityFilterForLevels(ALL_LEVELS)).not.toContain(null);
  });
});

describe('videoFitsComplexity', () => {
  const levels: AthleteComplexity[] = [
    Complexity.BEGINNER,
    Complexity.AMATEUR,
    Complexity.ADVANCED,
    Complexity.PRO,
  ];

  it('«Любой» подходит каждому уровню', () => {
    for (const level of levels) {
      expect(videoFitsComplexity(Complexity.ANY, level)).toBe(true);
    }
  });

  it('точный уровень подходит, чужой — нет', () => {
    expect(videoFitsComplexity(Complexity.PRO, Complexity.PRO)).toBe(true);
    expect(videoFitsComplexity(Complexity.PRO, Complexity.BEGINNER)).toBe(false);
  });

  it('видео без уровня не подходит никому', () => {
    for (const level of levels) {
      expect(videoFitsComplexity(null, level)).toBe(false);
      expect(videoFitsComplexity(undefined, level)).toBe(false);
    }
  });
});

describe('selectModuleWithFallback + «Любой»', () => {
  beforeEach(() => {
    store.videos = [];
    // Подбор шумит console.log на каждой ступени — в тестах глушим.
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it.each(ALL_LEVELS)('видео «Любой» находится на первой ступени для уровня %s', async (level) => {
    store.videos = [warmup('any-warmup', Complexity.ANY)];
    const result = await selectModuleWithFallback(warmupCriteria([level]));
    expect(result.video?.id).toBe('any-warmup');
    expect(result.fallbackLevel).toBe('PERFECT_MATCH');
  });

  it('видео чужого уровня находится только на последнем фолбэке, «Любой» — сразу', async () => {
    store.videos = [warmup('pro-warmup', Complexity.PRO)];
    const onlyPro = await selectModuleWithFallback(warmupCriteria([ComplexityLevel.BEGINNER]));
    expect(onlyPro.video?.id).toBe('pro-warmup');
    expect(onlyPro.fallbackLevel).toBe('ANY_MODULE');

    store.videos = [warmup('pro-warmup', Complexity.PRO), warmup('any-warmup', Complexity.ANY)];
    const withAny = await selectModuleWithFallback(warmupCriteria([ComplexityLevel.BEGINNER]));
    expect(withAny.video?.id).toBe('any-warmup');
    expect(withAny.fallbackLevel).toBe('PERFECT_MATCH');
  });

  it('«Любой» выпадает наравне с видео точного уровня', async () => {
    store.videos = [
      warmup('beginner-warmup', Complexity.BEGINNER),
      warmup('any-warmup', Complexity.ANY),
    ];
    const random = vi.spyOn(Math, 'random');
    const picked = new Set<string>();
    for (const r of [0, 0.99]) {
      random.mockReturnValue(r);
      const result = await selectModuleWithFallback(warmupCriteria([ComplexityLevel.BEGINNER]));
      expect(result.fallbackLevel).toBe('PERFECT_MATCH');
      picked.add(result.video!.id);
    }
    random.mockRestore();
    expect(picked).toEqual(new Set(['beginner-warmup', 'any-warmup']));
  });

  it('видео без уровня («Не указано») по-прежнему только на ANY_MODULE', async () => {
    store.videos = [warmup('no-level-warmup', null)];
    const result = await selectModuleWithFallback(warmupCriteria([ComplexityLevel.AMATEUR]));
    expect(result.video?.id).toBe('no-level-warmup');
    expect(result.fallbackLevel).toBe('ANY_MODULE');
  });

  it('исключённое видео «Любой» не выбирается', async () => {
    store.videos = [warmup('any-warmup', Complexity.ANY)];
    const result = await selectModuleWithFallback(
      warmupCriteria([ComplexityLevel.PRO]),
      ['any-warmup']
    );
    expect(result.video).toBeNull();
  });
});
