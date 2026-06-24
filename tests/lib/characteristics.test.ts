import { describe, expect, it } from 'vitest';
import {
  videoLoadTypes,
  calculateWorkoutGains,
  BASE_GAIN,
  type CharacteristicType,
} from '@/lib/characteristics';

describe('videoLoadTypes — источник типов нагрузки', () => {
  it('берёт прямое поле video.loadType (enum), даже если LOAD-тегов нет', () => {
    expect(videoLoadTypes({ loadType: 'SPEED', videoTags: [] })).toEqual(['SPEED']);
    // именно этот кейс раньше давал [] → прирост 0 (баг)
    expect(videoLoadTypes({ loadType: 'POWER' })).toEqual(['POWER']);
  });

  it('фолбэк на LOAD-теги, если enum не задан', () => {
    const v = {
      loadType: null,
      videoTags: [
        { tag: { tagType: 'LOAD', loadType: 'AGILITY' } },
        { tag: { tagType: 'MUSCLE', loadType: null } }, // не LOAD — игнор
      ],
    };
    expect(videoLoadTypes(v)).toEqual(['AGILITY']);
  });

  it('нет ни enum, ни тегов → пусто', () => {
    expect(videoLoadTypes({ loadType: null, videoTags: [] })).toEqual([]);
    expect(videoLoadTypes({})).toEqual([]);
  });
});

describe('calculateWorkoutGains — регресс: прирост начисляется по loadType', () => {
  const current: Record<CharacteristicType, number> = {
    ratingPower: 41.5,
    ratingSpeed: 41.5,
    ratingEndurance: 41.5,
    ratingTechnique: 41.5,
    ratingFlexibility: 41.5,
  };

  it('видео с loadType (через videoLoadTypes) даёт НЕнулевой прирост', () => {
    const moduleTags = [videoLoadTypes({ loadType: 'SPEED' })]; // [['SPEED']]
    const gains = calculateWorkoutGains(moduleTags, current, [false]);
    // SPEED → +скорость, +выносливость; при 41.5 прирост = 0.5*0.585*1 ≈ 0.2925
    expect(gains.ratingSpeed).toBeGreaterThan(0);
    expect(gains.ratingEndurance).toBeGreaterThan(0);
    expect(gains.ratingSpeed).toBeCloseTo(BASE_GAIN * ((100 - 41.5) / 100), 3);
  });

  it('пустые теги (старый баг — видео без LOAD-тега) дают нулевой прирост', () => {
    const gains = calculateWorkoutGains([[]], current, [false]);
    expect(gains.ratingSpeed).toBe(0);
    expect(gains.ratingPower).toBe(0);
  });

  it('полная сессия из нескольких модулей суммирует прирост', () => {
    const moduleTags = [
      videoLoadTypes({ loadType: 'POWER' }),
      videoLoadTypes({ loadType: 'MAX_STRENGTH' }),
      videoLoadTypes({ loadType: 'AEROBIC_ENDURANCE' }),
    ];
    const gains = calculateWorkoutGains(moduleTags, current, [false, false, false]);
    expect(gains.ratingPower).toBeGreaterThan(0); // POWER + MAX_STRENGTH
  });
});
