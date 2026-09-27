import { describe, it, expect } from 'vitest';
import { LANDMARKS, LM, encodeFrame, type Landmark } from '../../src/lib/pose/reference';
import {
  MAX_SEGMENTS,
  activeMs,
  detectSegments,
  isActiveAt,
  normalizeSegments,
  parseSegments,
} from '../../src/lib/pose/segments';

// Кадр стоящего человека; kneeAngleDeg задаёт сгиб левого колена
function frame(tMs: number, kneeAngleDeg: number, visible = true): number[] {
  const lm: Landmark[] = Array.from({ length: LANDMARKS }, () => ({ x: 0.5, y: 0.5, visibility: visible ? 0.9 : 0.1 }));
  const world: Landmark[] = Array.from({ length: LANDMARKS }, () => ({ x: 0, y: 0, z: 0 }));
  const set = (i: number, x: number, y: number, z = 0) => (world[i] = { x, y, z });
  set(LM.lShoulder, 0.2, -0.5);
  set(LM.rShoulder, -0.2, -0.5);
  set(LM.lHip, 0.1, 0);
  set(LM.rHip, -0.1, 0);
  set(LM.rKnee, -0.1, 0.45);
  set(LM.rAnkle, -0.1, 0.9);
  set(LM.lElbow, 0.25, -0.2);
  set(LM.lWrist, 0.25, 0.1);
  set(LM.rElbow, -0.25, -0.2);
  set(LM.rWrist, -0.25, 0.1);
  // Колено: бедро (0,0) → колено (0,0.45) → голеностоп под углом kneeAngleDeg
  const rad = ((180 - kneeAngleDeg) * Math.PI) / 180;
  set(LM.lKnee, 0.1, 0.45);
  set(LM.lAnkle, 0.1, 0.45 + 0.45 * Math.cos(rad), 0.45 * Math.sin(rad));
  return encodeFrame(tMs, lm, world);
}

/** 10 кадров в секунду: [0,20) объяснение, [20,50) приседания, [50,60) объяснение */
function demoFrames(): number[][] {
  const frames: number[][] = [];
  for (let i = 0; i * 100 <= 60_000; i++) {
    const t = i * 100;
    const sec = t / 1000;
    const moving = sec >= 20 && sec < 50;
    const knee = moving ? 130 + 45 * Math.sin(sec * Math.PI) : 178 + (i % 2); // лёгкий шум в покое
    frames.push(frame(t, knee));
  }
  return frames;
}

describe('detectSegments', () => {
  it('находит именно рабочий кусок, объяснения отбрасывает', () => {
    const segs = detectSegments(demoFrames(), 60_000);
    expect(segs).toHaveLength(1);
    expect(segs[0]!.startMs).toBeGreaterThan(18_000);
    expect(segs[0]!.startMs).toBeLessThan(22_000);
    expect(segs[0]!.endMs).toBeGreaterThan(48_000);
    expect(segs[0]!.endMs).toBeLessThan(52_000);
  });

  it('короткий взмах во время объяснения не становится упражнением', () => {
    const frames: number[][] = [];
    for (let i = 0; i * 100 <= 30_000; i++) {
      const sec = (i * 100) / 1000;
      const wave = sec >= 10 && sec < 11; // одна секунда движения
      frames.push(frame(i * 100, wave ? 130 + 45 * Math.sin(sec * Math.PI * 2) : 178));
    }
    expect(detectSegments(frames, 30_000)).toEqual([]);
  });

  it('пауза в пару секунд внутри упражнения не рвёт отрезок', () => {
    const frames: number[][] = [];
    for (let i = 0; i * 100 <= 40_000; i++) {
      const sec = (i * 100) / 1000;
      const pause = sec >= 18 && sec < 19.5;
      const moving = sec >= 5 && sec < 35 && !pause;
      frames.push(frame(i * 100, moving ? 130 + 45 * Math.sin(sec * Math.PI) : 178));
    }
    const segs = detectSegments(frames, 40_000);
    expect(segs).toHaveLength(1);
    expect(segs[0]!.endMs - segs[0]!.startMs).toBeGreaterThan(25_000);
  });

  it('кадры без тренера в кадре — не упражнение', () => {
    const frames = Array.from({ length: 200 }, (_, i) => [i * 100]);
    expect(detectSegments(frames, 20_000)).toEqual([]);
  });

  it('пустое видео — пустая разметка', () => {
    expect(detectSegments([], 0)).toEqual([]);
  });
});

describe('normalizeSegments', () => {
  it('сортирует, склеивает пересечения, режет по длине видео', () => {
    expect(
      normalizeSegments([{ startMs: 5000, endMs: 9000 }, { startMs: 1000, endMs: 6000 }, { startMs: 9500, endMs: 99_000 }], 20_000),
    ).toEqual([{ startMs: 1000, endMs: 9000 }, { startMs: 9500, endMs: 20_000 }]);
  });
  it('перевёрнутый и пустой отрезок', () => {
    expect(normalizeSegments([{ startMs: 900, endMs: 100 }], 10_000)).toEqual([{ startMs: 100, endMs: 900 }]);
    expect(normalizeSegments([{ startMs: 500, endMs: 500 }], 10_000)).toEqual([]);
  });
});

describe('activeMs / isActiveAt', () => {
  const segs = [{ startMs: 1000, endMs: 3000 }, { startMs: 5000, endMs: 6000 }];
  it('чистое время и попадание момента', () => {
    expect(activeMs(segs)).toBe(3000);
    expect(isActiveAt(segs, 1500)).toBe(true);
    expect(isActiveAt(segs, 3000)).toBe(false);
    expect(isActiveAt(segs, 4000)).toBe(false);
    expect(isActiveAt(segs, 5999)).toBe(true);
  });
});

describe('parseSegments', () => {
  it('нормализует корректный ввод', () => {
    expect(parseSegments([{ startMs: 2000, endMs: 1000 }], 10_000)).toEqual([{ startMs: 1000, endMs: 2000 }]);
  });
  it('мусор и перебор по количеству — null', () => {
    expect(parseSegments('нет', 10_000)).toBeNull();
    expect(parseSegments([{ startMs: 'x', endMs: 1 }], 10_000)).toBeNull();
    expect(parseSegments([{ startMs: 1, endMs: NaN }], 10_000)).toBeNull();
    expect(parseSegments(Array.from({ length: MAX_SEGMENTS + 1 }, (_, i) => ({ startMs: i * 10, endMs: i * 10 + 5 })), 10_000)).toBeNull();
  });
});
