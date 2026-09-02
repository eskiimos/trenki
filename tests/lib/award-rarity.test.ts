import { describe, it, expect } from 'vitest';
import { awardRarity, pickTopAwards } from '../../src/lib/award-rarity';
import { STREAK_ACHIEVEMENT_DEFS } from '../../src/lib/streak-achievements';
import { ACHIEVEMENT_DEFS } from '../../src/lib/achievements';

const a = (key: string, unlocked = true) => ({ key, title: key, unlocked });

describe('awardRarity', () => {
  it('у каждой награды обеих групп есть вес > 0', () => {
    for (const d of STREAK_ACHIEVEMENT_DEFS) {
      expect(awardRarity(d.key), d.key).toBeGreaterThan(0);
    }
    for (const d of ACHIEVEMENT_DEFS) {
      expect(awardRarity(d.key), d.key).toBeGreaterThan(0);
    }
  });

  it('порядок сложности внутри серий', () => {
    expect(awardRarity('streak_14')).toBeGreaterThan(awardRarity('streak_7'));
    expect(awardRarity('streak_7')).toBeGreaterThan(awardRarity('streak_5'));
    expect(awardRarity('streak_5')).toBeGreaterThan(awardRarity('streak_3'));
  });

  it('вторая ступень древа дороже первой', () => {
    expect(awardRarity('shot_evo2')).toBeGreaterThan(awardRarity('shot_evo1'));
  });

  it('«первая тренировка» — самая простая', () => {
    const all = [...STREAK_ACHIEVEMENT_DEFS.map((d) => d.key), 'shot_evo1'];
    const min = Math.min(...all.map(awardRarity));
    expect(awardRarity('workouts_1')).toBe(min);
  });

  it('неизвестный ключ не ломает расчёт', () => {
    expect(awardRarity('нет_такой')).toBe(0);
  });
});

describe('pickTopAwards', () => {
  it('меньше лимита — отдаёт всё, что есть', () => {
    const picked = pickTopAwards([a('workouts_1'), a('streak_3')]);
    expect(picked.map((p) => p.key)).toEqual(['streak_3', 'workouts_1']);
  });

  it('больше лимита — оставляет САМЫЕ СЛОЖНЫЕ', () => {
    const picked = pickTopAwards([
      a('workouts_1'), a('streak_3'), a('early_bird'), a('weekend_warrior'),
      a('streak_5'), a('workouts_30'), a('streak_7'), a('workouts_100'),
    ]);
    expect(picked.map((p) => p.key)).toEqual([
      'workouts_100', 'streak_7', 'workouts_30', 'streak_5', 'weekend_warrior',
    ]);
    expect(picked).toHaveLength(5);
  });

  it('неполученные не показываются', () => {
    const picked = pickTopAwards([a('workouts_100', false), a('streak_3', true)]);
    expect(picked.map((p) => p.key)).toEqual(['streak_3']);
  });

  it('пусто — пустой список, ничего не падает', () => {
    expect(pickTopAwards([])).toEqual([]);
  });

  it('порядок стабилен при равных весах', () => {
    const first = pickTopAwards([a('shot_evo1'), a('hands_evo1'), a('agility_evo1')], 2);
    const second = pickTopAwards([a('agility_evo1'), a('shot_evo1'), a('hands_evo1')], 2);
    expect(first.map((p) => p.key)).toEqual(second.map((p) => p.key));
  });

  it('закреплённая награда всегда первая, даже если простая', () => {
    const picked = pickTopAwards(
      [a('workouts_100'), a('streak_14'), a('workouts_1')],
      5,
      'workouts_1',
    );
    expect(picked.map((p) => p.key)).toEqual(['workouts_1', 'workouts_100', 'streak_14']);
  });

  it('закреплённая не дублируется в списке', () => {
    const picked = pickTopAwards([a('streak_7'), a('streak_3')], 5, 'streak_3');
    expect(picked.map((p) => p.key)).toEqual(['streak_3', 'streak_7']);
    expect(new Set(picked.map((p) => p.key)).size).toBe(picked.length);
  });

  it('закреплённая, но ещё не полученная — игнорируется', () => {
    const picked = pickTopAwards([a('streak_7'), a('workouts_100', false)], 5, 'workouts_100');
    expect(picked.map((p) => p.key)).toEqual(['streak_7']);
  });

  it('закреплённая вытесняет последнюю по сложности, а не добавляется сверх лимита', () => {
    const picked = pickTopAwards(
      [a('workouts_100'), a('streak_14'), a('streak_7'), a('workouts_30'), a('streak_5'), a('workouts_1')],
      5,
      'workouts_1',
    );
    expect(picked).toHaveLength(5);
    expect(picked[0].key).toBe('workouts_1');
    expect(picked.map((p) => p.key)).not.toContain('streak_5');
  });

  it('лимит настраивается', () => {
    expect(pickTopAwards([a('streak_3'), a('streak_5'), a('streak_7')], 2)).toHaveLength(2);
  });
});
