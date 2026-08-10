import { describe, it, expect } from 'vitest';
import {
  ACHIEVEMENT_DEFS,
  SKILL_TREE,
  EVO1_TARGET,
  EVO2_TARGET,
  computeAchievements,
} from '../../src/lib/achievements';
import type { TrainingGoal } from '../../src/generated/prisma';

const byKey = (list: ReturnType<typeof computeAchievements>, key: string) => {
  const a = list.find((x) => x.key === key);
  if (!a) throw new Error(`нет ачивки ${key}`);
  return a;
};

describe('набор «Древо навыков»', () => {
  it('14 штук (7 целей × 2 эволюции), ключи уникальны, у всех title/описание/эмодзи', () => {
    expect(ACHIEVEMENT_DEFS.length).toBe(14);
    expect(SKILL_TREE.length).toBe(7);
    expect(new Set(ACHIEVEMENT_DEFS.map((d) => d.key)).size).toBe(14);
    for (const d of ACHIEVEMENT_DEFS) {
      expect(d.title.length).toBeGreaterThan(0);
      expect(d.description.length).toBeGreaterThan(0);
      expect(d.emoji.length).toBeGreaterThan(0);
    }
    expect(computeAchievements({}).length).toBe(14);
  });

  it('порядок: по каждой цели SKILL_TREE идут evo1 (порог 5), затем evo2 (порог 10)', () => {
    const expectedKeys = SKILL_TREE.flatMap((b) => [b.evo1.key, b.evo2.key]);
    expect(ACHIEVEMENT_DEFS.map((d) => d.key)).toEqual(expectedKeys);
    expect(computeAchievements({}).map((a) => a.key)).toEqual(expectedKeys);

    for (const b of SKILL_TREE) {
      const evo1 = ACHIEVEMENT_DEFS.find((d) => d.key === b.evo1.key)!;
      const evo2 = ACHIEVEMENT_DEFS.find((d) => d.key === b.evo2.key)!;
      expect(evo1.goal).toBe(b.goal);
      expect(evo1.tier).toBe(1);
      expect(evo1.target).toBe(EVO1_TARGET);
      expect(evo2.goal).toBe(b.goal);
      expect(evo2.tier).toBe(2);
      expect(evo2.target).toBe(EVO2_TARGET);
    }
    expect(EVO1_TARGET).toBe(5);
    expect(EVO2_TARGET).toBe(10);
  });
});

describe('пороги эволюций на границе', () => {
  it('4 → evo1 закрыта, 5 → evo1 открыта', () => {
    expect(byKey(computeAchievements({ AGILITY: 4 }), 'agility_evo1').unlocked).toBe(false);
    expect(byKey(computeAchievements({ AGILITY: 5 }), 'agility_evo1').unlocked).toBe(true);
  });

  it('9 → evo2 закрыта, 10 → evo2 открыта', () => {
    const nine = computeAchievements({ POWERFUL_SHOT: 9 });
    expect(byKey(nine, 'shot_evo1').unlocked).toBe(true); // evo1 уже открыта на 5
    expect(byKey(nine, 'shot_evo2').unlocked).toBe(false);
    const ten = computeAchievements({ POWERFUL_SHOT: 10 });
    expect(byKey(ten, 'shot_evo2').unlocked).toBe(true);
  });

  it('progress обрезан по target', () => {
    // 7 завершённых по цели: evo1 (target 5) обрезана до 5, evo2 (target 10) — 7
    const list = computeAchievements({ OUTRUN_OPPONENT: 7 });
    expect(byKey(list, 'outrun_evo1').progress).toEqual({ current: 5, target: 5 });
    expect(byKey(list, 'outrun_evo2').progress).toEqual({ current: 7, target: 10 });
    // 100 завершённых: обе обрезаны по своему target
    const many = computeAchievements({ OUTRUN_OPPONENT: 100 });
    expect(byKey(many, 'outrun_evo1').progress).toEqual({ current: 5, target: 5 });
    expect(byKey(many, 'outrun_evo2').progress).toEqual({ current: 10, target: 10 });
  });
});

describe('цель без завершений и лишние ключи', () => {
  it('цель с 0 (или отсутствующая в мапе) → обе ачивки закрыты, прогресс 0', () => {
    const list = computeAchievements({ SPORT_LONGEVITY: 0 });
    for (const key of ['longevity_evo1', 'longevity_evo2']) {
      const a = byKey(list, key);
      expect(a.unlocked).toBe(false);
      expect(a.progress.current).toBe(0);
    }
    // Та же картина, если цели вообще нет во входной мапе
    const empty = computeAchievements({});
    expect(byKey(empty, 'longevity_evo1').progress.current).toBe(0);
    expect(empty.every((a) => !a.unlocked)).toBe(true);
  });

  it('неизвестные цели во входе игнорируются, не ломают расчёт', () => {
    const input = {
      STRENGTH_STABILITY: 5,
      // намеренно несуществующая цель — должна быть проигнорирована
      NOT_A_GOAL: 999,
    } as unknown as Partial<Record<TrainingGoal, number>>;
    const list = computeAchievements(input);
    expect(list.length).toBe(14);
    expect(byKey(list, 'strength_evo1').unlocked).toBe(true);
    expect(byKey(list, 'strength_evo2').unlocked).toBe(false);
  });
});
