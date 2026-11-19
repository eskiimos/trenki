import { describe, expect, it } from 'vitest';
import type { ModuleType } from '@/generated/prisma';
import { editableMacrocycleSlots, replacementCandidates } from '@/lib/microcycle/macrocycle-edit';
import { selectMacrocycleVideos, type MacrocycleVideo } from '@/lib/microcycle/macrocycle-selection';

function video(id: string, overrides: Partial<MacrocycleVideo> = {}): MacrocycleVideo {
  return {
    id, moduleType: 'COOLDOWN', duration: 150, loadType: 'STATIC_STRETCH', loadTypes: ['STATIC_STRETCH'],
    muscleGroup: 'LOWER_BODY', complexity: 'BEGINNER', ...overrides,
  };
}

describe('editing a Cycle 2.0 workout', () => {
  const slots = editableMacrocycleSlots(3, 'STRETCH', 'lower');
  const catalog = [
    video('warmup', { moduleType: 'WARMUP' }),
    video('shoulder', { loadType: 'PREHAB', loadTypes: ['PREHAB'], muscleGroup: 'PREHAB_SHOULDER' }),
    video('wrong-pair', { loadType: 'PREHAB', loadTypes: ['PREHAB'], muscleGroup: 'LOWER_BODY' }),
    video('knee', { loadType: 'PREHAB', loadTypes: ['PREHAB'], muscleGroup: 'PREHAB_KNEE' }),
  ];
  const current = { id: 'link', order: 0, videoId: 'knee', video: { moduleType: 'COOLDOWN' as ModuleType, duration: 150 } };

  it('applies the requested recovery direction even during another focus and pairs prehab with its joint', () => {
    expect(selectMacrocycleVideos(slots, catalog, 0).map(v => v?.id)).toEqual(['warmup', 'knee']);
    expect(selectMacrocycleVideos(slots, catalog.filter(v => v.id !== 'knee'), 0)[1]).toBeNull();
    expect(editableMacrocycleSlots(3, 'TIRED', 'lower')).toEqual(editableMacrocycleSlots(3, 'TIRED', null));
  });

  it('retains the saved direction in both pickers and prefers a fresh suitable alternative', () => {
    const edit = {
      phase: 3 as const, intent: 'STRETCH' as const, stretchBodyPart: 'lower', dayId: 'day',
      potential: 0, videos: [current], usedIds: new Set(['used']),
      catalog: [...catalog, video('new'), video('used'), video('pro', { complexity: 'PRO' })],
    };
    const auto = replacementCandidates(edit, current, false).map(v => v.id);
    expect(auto).toEqual(['new', 'used']);
    const manual = replacementCandidates(edit, current, true).map(v => v.id);
    expect(new Set(manual)).toEqual(new Set(['new', 'used', 'knee']));
    expect(replacementCandidates(edit, current, false, ['UPPER_PUSH', 'UPPER_PULL'])).toEqual([]);
  });
});
