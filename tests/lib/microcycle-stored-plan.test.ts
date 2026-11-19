import { describe, expect, it } from 'vitest';
import type { MicrocycleIntent } from '@/generated/prisma';
import { macrocycleWeekLabel, missingMacrocycleModules, storedDayPlans } from '@/lib/microcycle/stored-plan';

const days = [
  { dayOfWeek: 1, intent: 'IN_TONE' },
  { dayOfWeek: 2, intent: 'WARMUP' },
  { dayOfWeek: 3, intent: 'CHARGED' },
] satisfies { dayOfWeek: number; intent: MicrocycleIntent }[];

describe('reading saved microcycles', () => {
  it('keeps legacy goals and titles in existing plans and favorites', () => {
    const plans = storedDayPlans({ days, cycleNumber: 1, macrocycleWeek: null });
    expect(plans.map(({ goal }) => goal)).toEqual(['POWERFUL_SHOT', 'AGILITY', 'OUTRUN_OPPONENT']);
    expect(plans.map(({ label }) => label)).toEqual(['Стандарт', 'Зарядка', 'Овертайм']);
    expect(macrocycleWeekLabel(null)).toBeNull();
  });

  it('labels new weeks with their recorded phase regardless of older plans', () => {
    const plans = storedDayPlans({ days, cycleNumber: 23, macrocycleWeek: 2 });
    expect(plans.map(({ goal }) => goal)).toEqual([null, null, null]);
    expect(plans.map(({ label }) => label)).toEqual(['Стандарт', 'Зарядка', 'Овертайм']);
    expect(macrocycleWeekLabel(2)).toBe('Неделя 2 из 4 · Ноги');
  });

  it('reports missing module types only for a templated day', () => {
    expect(missingMacrocycleModules(2, 'CHARGED', ['FITNESS', 'COOLDOWN'])).toEqual(['WARMUP', 'TECHNIQUE']);
    expect(missingMacrocycleModules(2, 'WARMUP', ['WARMUP'])).toEqual([]);
    expect(missingMacrocycleModules(null, 'CHARGED', [])).toEqual([]);
  });
});
