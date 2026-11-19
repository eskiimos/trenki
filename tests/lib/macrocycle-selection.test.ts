import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  loadMacrocycleCatalog, rankMacrocycleCandidates, selectMacrocycleVideos, type MacrocycleVideo,
} from '@/lib/microcycle/macrocycle-selection';
import type { MacrocycleSlot } from '@/lib/microcycle/macrocycle-templates';

const findMany = vi.hoisted(() => vi.fn());
vi.mock('@/lib/prisma', () => ({ prisma: { video: { findMany } } }));
afterEach(() => { vi.restoreAllMocks(); findMany.mockReset(); });

const warmup: MacrocycleSlot = { moduleType: 'WARMUP', alternatives: [{}] };
const legWarmup: MacrocycleSlot = { ...warmup, alternatives: [{ muscles: ['LOWER_BODY'] }] };
function video(id: string, fields: Partial<MacrocycleVideo> = {}): MacrocycleVideo {
  return {
    id, duration: 120, complexity: 'BEGINNER', moduleType: 'WARMUP', muscleGroup: 'LOWER_BODY',
    loadType: 'SPEED', loadTypes: ['SPEED'], ...fields,
  };
}

describe('macrocycle catalog', () => {
  it('requires an age group and restricts the SQL query to eligible published videos', async () => {
    expect(await loadMacrocycleCatalog(null)).toEqual([]);
    expect(findMany).not.toHaveBeenCalled();
    findMany.mockResolvedValue([]);
    await loadMacrocycleCatalog('CHILD');
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        audience: { in: ['HOCKEY', 'ALL'] }, isPublished: true, ageGroups: { has: 'CHILD' },
        moduleType: { not: null }, complexity: { not: null },
      },
    }));
  });

  it('uses the visible LOAD tags, with a scalar fallback for older videos', async () => {
    findMany.mockResolvedValue([
      { ...video('tagged'), videoTags: [{ tag: { loadType: 'POWER' } }, { tag: { loadType: 'AGILITY' } }] },
      { ...video('scalar'), videoTags: [] },
    ]);
    const catalog = await loadMacrocycleCatalog('TEEN');
    expect(catalog.map(v => v.loadTypes)).toEqual([['POWER', 'AGILITY'], ['SPEED']]);
    expect(rankMacrocycleCandidates({ ...warmup, alternatives: [{ loads: ['AGILITY'] }] }, catalog, 5)
      .map(v => v.id)).toEqual(['tagged']);
  });
});

describe('macrocycle video selection', () => {
  it('keeps module type, complete load/direction alternatives, and exclusions mandatory', () => {
    const slot: MacrocycleSlot = { ...warmup, alternatives: [
      { loads: ['DYNAMIC_STRETCH'], excludeMuscles: ['LOWER_BODY', 'PREHAB_KNEE'] },
      { loads: ['PREHAB'], muscles: ['PREHAB_SHOULDER'] },
    ] };
    const catalog = [
      video('stretch', { muscleGroup: 'UPPER_PULL', loadTypes: ['DYNAMIC_STRETCH'] }),
      video('shoulder', { muscleGroup: 'PREHAB_SHOULDER', loadTypes: ['PREHAB'] }),
      video('cross-pair', { muscleGroup: 'UPPER_PULL', loadTypes: ['PREHAB'] }),
      video('knee', { muscleGroup: 'PREHAB_KNEE', loadTypes: ['DYNAMIC_STRETCH'] }),
      video('untagged-direction', { muscleGroup: null, loadTypes: ['DYNAMIC_STRETCH'] }),
      video('wrong-type', { moduleType: 'COOLDOWN', muscleGroup: 'UPPER_PULL', loadTypes: ['DYNAMIC_STRETCH'] }),
    ];
    expect(rankMacrocycleCandidates(slot, catalog, 15).map(v => v.id).sort()).toEqual(['shoulder', 'stretch']);
  });

  it('ranks nearby levels, accepts ANY, enforces the level gap in both directions', () => {
    const catalog = [video('missing', { complexity: null }), video('pro', { complexity: 'PRO' }),
      video('plus-two', { complexity: 'ADVANCED' }), video('plus-one', { complexity: 'AMATEUR' }),
      video('exact'), video('universal', { complexity: 'ANY' })];
    const ranked = rankMacrocycleCandidates(warmup, catalog, 10).map(v => v.id);
    expect(ranked.slice(0, 2).sort()).toEqual(['exact', 'universal']);
    expect(ranked.slice(2)).toEqual(['plus-one', 'plus-two']);
    expect(rankMacrocycleCandidates(warmup, catalog, 100).map(v => v.id)).not.toContain('exact');
  });

  it('favours the requested muscle group with equal age and skill fit', () => {
    const [choice] = selectMacrocycleVideos([{ ...warmup, preferredMuscles: ['LOWER_BODY'] }], [
      video('generic', { muscleGroup: 'FULL_BODY' }), video('preferred'),
    ], 10);
    expect(choice?.id).toBe('preferred');
  });

  it('can reassign a flexible slot to avoid taking the only match for a later slot', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const catalog = [video('legs'), video('full', { muscleGroup: 'FULL_BODY' }), video('advanced-legs', { complexity: 'ADVANCED' })];
    expect(selectMacrocycleVideos([warmup, legWarmup], catalog, 5).map(v => v?.id)).toEqual(['full', 'legs']);
  });

  it('allows a bounded skill fallback before repeating and never fills an ineligible slot', () => {
    const catalog = [video('legs'), video('nearby', { complexity: 'AMATEUR' }), video('pro', { complexity: 'PRO' })];
    const picks = selectMacrocycleVideos([legWarmup, legWarmup, legWarmup,
      { moduleType: 'TECHNIQUE', alternatives: [{}] }], catalog, 3);
    expect(picks.slice(0, 3).map(v => v?.id).sort()).toEqual(['legs', 'legs', 'nearby']);
    expect(picks[3]).toBeNull();
  });

  it('spreads unavoidable duplicates between equivalent videos', () => {
    const picks = selectMacrocycleVideos(Array(6).fill(warmup), [video('a'), video('b')], 10);
    expect(picks.filter(v => v?.id === 'a')).toHaveLength(3);
    expect(picks.filter(v => v?.id === 'b')).toHaveLength(3);
  });

  it('excludes the current module and prefers unused alternatives for replacements', () => {
    const options = { excludeIds: new Set(['current']), usedIds: new Set(['elsewhere']) };
    const catalog = [video('current'), video('elsewhere'), video('new', { complexity: 'AMATEUR' })];
    expect(rankMacrocycleCandidates(warmup, catalog, 15, options).map(v => v.id)).toEqual(['new', 'elsewhere']);
    expect(selectMacrocycleVideos([warmup], catalog, 15, options)[0]?.id).toBe('new');
    expect(selectMacrocycleVideos([warmup], catalog.slice(0, 2), 15, options)[0]?.id).toBe('elsewhere');
  });
});
