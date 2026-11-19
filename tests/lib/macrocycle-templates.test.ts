import { describe, expect, it } from 'vitest';
import { isMacrocyclePhase, macrocycleSlots } from '@/lib/microcycle/macrocycle-templates';

describe('Cycle 2.0 templates', () => {
  for (const phase of [1, 2, 3, 4] as const) {
    it(`preserves the ordered modules for all five day intents in phase ${phase}`, () => {
      const intents = ['IN_TONE', 'WARMUP', 'CHARGED', 'STRETCH', 'TIRED'] as const;
      const moduleTypes = intents.map(intent => macrocycleSlots(phase, intent).map(slot => slot.moduleType));
      expect(moduleTypes).toEqual([
        ['WARMUP', 'FITNESS', 'TECHNIQUE'],
        ['WARMUP'],
        ['WARMUP', 'FITNESS', 'TECHNIQUE', 'COOLDOWN'],
        ['WARMUP', 'COOLDOWN'],
        ['WARMUP', 'FITNESS', 'TECHNIQUE', 'COOLDOWN'],
      ]);
    });
  }

  it('keeps only knee prehab as an alternative to a lower-body stretch on the legs Friday', () => {
    expect(macrocycleSlots(2, 'TIRED')[3].alternatives).toEqual([
      { loads: ['DYNAMIC_STRETCH', 'STATIC_STRETCH'], muscles: ['LOWER_BODY'] },
      { loads: ['PREHAB'], muscles: ['PREHAB_KNEE'] },
    ]);
  });

  it('allows only upper-body directions for Monday technique but treats upper as a preference on Wednesday', () => {
    const monday = macrocycleSlots(3, 'IN_TONE')[2];
    const wednesday = macrocycleSlots(3, 'CHARGED')[2];
    expect(monday.alternatives[0].muscles).toEqual(['UPPER_PUSH', 'UPPER_PULL']);
    expect(wednesday.alternatives[0].muscles).toBeUndefined();
    expect(wednesday.preferredMuscles).toEqual(['UPPER_PUSH', 'UPPER_PULL']);
    expect(macrocycleSlots(3, 'TIRED')[3].alternatives[0].excludeMuscles).toEqual(['LOWER_BODY', 'PREHAB_KNEE']);
  });

  it('distinguishes direction-only core slots from load-or-direction alternatives', () => {
    expect(macrocycleSlots(4, 'IN_TONE')[1].alternatives).toEqual([{ muscles: ['CORE_DYNAMICS'] }]);
    expect(macrocycleSlots(4, 'CHARGED')[1].alternatives).toEqual([{ muscles: ['CORE_STABILITY'] }]);
    expect(macrocycleSlots(4, 'TIRED')[1].alternatives).toEqual([
      { loads: ['AGILITY', 'MOBILITY'] }, { muscles: ['CORE_DYNAMICS'] },
    ]);
  });

  it('recognises only the four stored phases', () => {
    expect([null, 0, 1, 2, 2.5, 3, 4, 5].filter(isMacrocyclePhase)).toEqual([1, 2, 3, 4]);
  });
});
