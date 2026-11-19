import type { AgeGroup, ComplexityLevel, LoadType, Prisma, Video } from '@/generated/prisma';
import { prisma } from '@/lib/prisma';
import { getComplexityLevel } from '@/lib/training-algorithm-v3';
import type { MacrocycleFilter, MacrocycleSlot } from './macrocycle-templates';

export type MacrocycleVideo = Pick<Video,
  'id' | 'duration' | 'moduleType' | 'loadType' | 'muscleGroup' | 'complexity'
> & { loadTypes: LoadType[] };

/** Load the age-appropriate catalog once for all slots of a hockey week. */
export async function loadMacrocycleCatalog(
  ageGroup: AgeGroup | null | undefined,
  db: Pick<Prisma.TransactionClient, 'video'> = prisma,
): Promise<MacrocycleVideo[]> {
  if (!ageGroup) return [];
  const videos = await db.video.findMany({
    where: {
      isPublished: true,
      audience: { in: ['HOCKEY', 'ALL'] },
      ageGroups: { has: ageGroup },
      moduleType: { not: null },
      complexity: { not: null },
    },
    select: {
      id: true, duration: true, moduleType: true, loadType: true, muscleGroup: true,
      complexity: true,
      videoTags: {
        where: { tag: { tagType: 'LOAD', loadType: { not: null } } },
        select: { tag: { select: { loadType: true } } },
      },
    },
  });
  // Keep the same load labels as the video catalog, including older scalar-only entries.
  return videos.map(({ videoTags, ...video }) => {
    const tags = videoTags.flatMap(({ tag }) => tag.loadType ? [tag.loadType] : []);
    return { ...video, loadTypes: tags.length ? tags : video.loadType ? [video.loadType] : [] };
  });
}

interface SelectionOptions {
  /** Modules that cannot be offered, e.g. the module being replaced. */
  excludeIds?: ReadonlySet<string>;
  /** Modules already on other days of the week. Reuse only if necessary. */
  usedIds?: ReadonlySet<string>;
}

const levelRanks: Record<ComplexityLevel, number> = { BEGINNER: 0, AMATEUR: 1, ADVANCED: 2, PRO: 3 };
const maxLevelDistance = 2;

function matchesFilter(video: MacrocycleVideo, filter: MacrocycleFilter): boolean {
  if (filter.loads && !filter.loads.some(load => video.loadTypes.includes(load))) return false;
  if (filter.muscles && (!video.muscleGroup || !filter.muscles.includes(video.muscleGroup))) return false;
  if (filter.excludeMuscles && (!video.muscleGroup || filter.excludeMuscles.includes(video.muscleGroup))) return false;
  return true;
}

function rankedCandidates(
  slot: MacrocycleSlot,
  catalog: readonly MacrocycleVideo[],
  athleteLevel: ComplexityLevel,
  options: SelectionOptions,
) {
  return catalog.flatMap(video => {
    if (options.excludeIds?.has(video.id) || video.moduleType !== slot.moduleType || !video.complexity) return [];
    const distance = video.complexity === 'ANY' ? 0 : Math.abs(levelRanks[video.complexity] - levelRanks[athleteLevel]);
    if (distance > maxLevelDistance || !slot.alternatives.some(filter => matchesFilter(video, filter))) return [];
    const missesPreference = slot.preferredMuscles && (!video.muscleGroup || !slot.preferredMuscles.includes(video.muscleGroup));
    // All same-level choices precede a skill fallback; within each level honour preferred muscles.
    const rank = 2 * distance + (missesPreference ? 1 : 0);
    return [{ video, rank, used: !!options.usedIds?.has(video.id), tieBreaker: Math.random() }];
  }).sort((a, b) => Number(a.used) - Number(b.used) || a.rank - b.rank || a.tieBreaker - b.tieBreaker);
}

export function rankMacrocycleCandidates(
  slot: MacrocycleSlot,
  catalog: readonly MacrocycleVideo[],
  potential: number,
  options: SelectionOptions = {},
): MacrocycleVideo[] {
  return rankedCandidates(slot, catalog, getComplexityLevel(potential), options).map(choice => choice.video);
}

/** Assign all slots together, retaining their order. A null slot has no eligible video. */
export function selectMacrocycleVideos(
  slots: readonly MacrocycleSlot[],
  catalog: readonly MacrocycleVideo[],
  potential: number,
  options: SelectionOptions = {},
): (MacrocycleVideo | null)[] {
  const level = getComplexityLevel(potential);
  const choices = slots.map(slot => rankedCandidates(slot, catalog, level, options));
  const assignments = slots.map((): MacrocycleVideo | null => null);
  const owner = new Map<string, number>();

  // Augment the matching: a scarce slot can reclaim a video if its previous slot
  // can move. Widely applicable modules therefore do not force avoidable repeats.
  function assignUnique(slot: number, maxRank: number, visited: Set<string>): boolean {
    for (const { video, rank, used } of choices[slot]) {
      if (used || rank > maxRank || visited.has(video.id)) continue;
      visited.add(video.id);
      const previous = owner.get(video.id);
      if (previous === undefined || assignUnique(previous, maxRank, visited)) {
        owner.set(video.id, slot);
        assignments[slot] = video;
        return true;
      }
    }
    return false;
  }

  // First try to fill the entire week at the athlete's level, then widen by
  // one level at a time, only while there are slots without a unique match.
  for (let rank = 0; rank <= 2 * maxLevelDistance + 1; rank++) {
    for (let slot = 0; slot < slots.length; slot++) {
      if (!assignments[slot]) assignUnique(slot, rank, new Set());
    }
  }

  // Only now allow duplicates. Spread equally suitable repeats across the week.
  const counts = new Map<string, number>();
  for (const id of options.usedIds ?? []) counts.set(id, 1);
  for (const id of owner.keys()) counts.set(id, 1);
  for (let slot = 0; slot < slots.length; slot++) {
    if (assignments[slot] || !choices[slot].length) continue;
    const best = choices[slot].reduce((a, b) => {
      if (a.rank !== b.rank) return a.rank < b.rank ? a : b;
      return (counts.get(a.video.id) ?? 0) <= (counts.get(b.video.id) ?? 0) ? a : b;
    }).video;
    assignments[slot] = best;
    counts.set(best.id, (counts.get(best.id) ?? 0) + 1);
  }
  return assignments;
}
