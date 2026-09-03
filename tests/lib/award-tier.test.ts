import { describe, it, expect } from 'vitest';
import { awardTier, TIER_STYLE, TIER_LABEL, SHOWCASE_SLOTS } from '../../src/lib/award-tier';
import { STREAK_ACHIEVEMENT_DEFS } from '../../src/lib/streak-achievements';
import { ACHIEVEMENT_DEFS } from '../../src/lib/achievements';

describe('awardTier', () => {
  it('«67» — эпическая, эволюции — серебро/золото, остальное — серые ачивки', () => {
    expect(awardTier('workouts_67')).toBe('epic');
    expect(awardTier('outrun_evo1')).toBe('silver');
    expect(awardTier('outrun_evo2')).toBe('gold');
    expect(awardTier('streak_3')).toBe('common');
    expect(awardTier('workouts_100')).toBe('common');
    expect(awardTier('unknown_key')).toBe('common');
  });

  it('у каждой награды обеих групп есть стиль и подпись тира', () => {
    for (const d of [...STREAK_ACHIEVEMENT_DEFS, ...ACHIEVEMENT_DEFS]) {
      const tier = awardTier(d.key);
      expect(TIER_STYLE[tier].background.length).toBeGreaterThan(0);
      expect(TIER_LABEL[tier].length).toBeGreaterThan(0);
    }
  });

  it('в древе эволюция 1 — только серебро, эволюция 2 — только золото', () => {
    for (const d of ACHIEVEMENT_DEFS) {
      expect(awardTier(d.key)).toBe(d.tier === 2 ? 'gold' : 'silver');
    }
  });

  it('в шапке 5 слотов', () => {
    expect(SHOWCASE_SLOTS).toBe(5);
  });
});
