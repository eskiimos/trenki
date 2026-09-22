import { describe, it, expect } from 'vitest';
import {
  FRAME_LEN,
  LANDMARKS,
  LM,
  encodeFrame,
  frameAngles,
  frameIndexAt,
  hasPose,
  jointAngle,
  point2d,
  summarizeReference,
  validateReferenceDoc,
  type Landmark,
} from '../../src/lib/pose/reference';

// Стоящий человек: всё видно, ноги прямые, корпус вертикально (y вниз)
function standing(overrides: Record<number, Partial<Landmark>> = {}, vis = 0.9) {
  const lm: Landmark[] = Array.from({ length: LANDMARKS }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: vis }));
  const world: Landmark[] = Array.from({ length: LANDMARKS }, () => ({ x: 0, y: 0, z: 0 }));
  const set = (i: number, x: number, y: number) => {
    world[i] = { x, y, z: 0 };
  };
  set(LM.lShoulder, 0.2, -0.5);
  set(LM.rShoulder, -0.2, -0.5);
  set(LM.lHip, 0.1, 0);
  set(LM.rHip, -0.1, 0);
  set(LM.lKnee, 0.1, 0.45);
  set(LM.rKnee, -0.1, 0.45);
  set(LM.lAnkle, 0.1, 0.9);
  set(LM.rAnkle, -0.1, 0.9);
  set(LM.lElbow, 0.25, -0.2);
  set(LM.lWrist, 0.25, 0.1);
  set(LM.rElbow, -0.25, -0.2);
  set(LM.rWrist, -0.25, 0.1);
  for (const [i, o] of Object.entries(overrides)) world[Number(i)] = { ...world[Number(i)]!, ...o };
  return { lm, world };
}

describe('encodeFrame', () => {
  it('поза → 199 целых чисел, без позы — только время', () => {
    const { lm, world } = standing();
    const f = encodeFrame(1234.6, lm, world);
    expect(f).toHaveLength(FRAME_LEN);
    expect(f[0]).toBe(1235);
    expect(f.every(Number.isInteger)).toBe(true);
    expect(point2d(f, 0)).toEqual({ x: 0.5, y: 0.5, v: 0.9 });
    expect(encodeFrame(500, null, null)).toEqual([500]);
    expect(hasPose([500])).toBe(false);
  });
});

describe('углы суставов', () => {
  it('jointAngle: прямая линия — 180°, прямой угол — 90°', () => {
    expect(jointAngle({ x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, { x: 0, y: 2, z: 0 })).toBeCloseTo(180);
    expect(jointAngle({ x: 1, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 0 })).toBeCloseTo(90);
  });

  it('стоя: колени ≈180°, корпус вертикально ≈0°', () => {
    const { lm, world } = standing();
    const a = frameAngles(encodeFrame(0, lm, world));
    expect(a.kneeL).toBe(180);
    expect(a.kneeR).toBe(180);
    expect(a.trunk).toBe(0);
  });

  it('присед: колено согнуто до ~90°, корпус наклонён', () => {
    const { lm, world } = standing({
      [LM.lKnee]: { x: 0.1, y: 0.0, z: -0.45 },
      [LM.lAnkle]: { x: 0.1, y: 0.45, z: -0.45 },
      [LM.lShoulder]: { x: 0.2, y: -0.35, z: -0.35 },
      [LM.rShoulder]: { x: -0.2, y: -0.35, z: -0.35 },
    });
    const a = frameAngles(encodeFrame(0, lm, world));
    expect(a.kneeL).toBe(90);
    expect(a.trunk).toBe(45);
  });

  it('плохо видимые точки — угол null, а не выдумка', () => {
    const { lm, world } = standing({}, 0.2);
    expect(frameAngles(encodeFrame(0, lm, world)).kneeL).toBeNull();
    expect(frameAngles([100]).kneeL).toBeNull();
  });
});

describe('frameIndexAt', () => {
  const frames = [[0], [100], [200], [300]];
  it('ближайший кадр к моменту видео', () => {
    expect(frameIndexAt(frames, 0)).toBe(0);
    expect(frameIndexAt(frames, 140)).toBe(1);
    expect(frameIndexAt(frames, 160)).toBe(2);
    expect(frameIndexAt(frames, 9999)).toBe(3);
    expect(frameIndexAt([], 10)).toBe(-1);
  });
});

describe('summarizeReference', () => {
  it('доля кадров с тренером и с видимыми ногами', () => {
    const { lm, world } = standing();
    const hidden = standing({}, 0.1);
    const doc = {
      durationMs: 400,
      frames: [encodeFrame(0, lm, world), encodeFrame(100, lm, world), encodeFrame(200, hidden.lm, hidden.world), [300]],
    };
    expect(summarizeReference(doc)).toEqual({ frameCount: 4, durationSec: 0.4, detectedRatio: 0.75, legsVisibleRatio: 0.5 });
  });
});

describe('validateReferenceDoc', () => {
  const { lm, world } = standing();
  const ok = { v: 1, model: 'pose_landmarker_heavy', fps: 10, durationMs: 1000, width: 640, height: 360, frames: [encodeFrame(0, lm, world), [100]] };

  it('корректный документ проходит', () => {
    expect(validateReferenceDoc(ok)).toBeNull();
  });

  it('отсекает мусор', () => {
    expect(validateReferenceDoc(null)).toBeTruthy();
    expect(validateReferenceDoc({ ...ok, v: 2 })).toMatch(/версия/);
    expect(validateReferenceDoc({ ...ok, model: 'evil' })).toMatch(/модель/);
    expect(validateReferenceDoc({ ...ok, fps: 120 })).toMatch(/fps/);
    expect(validateReferenceDoc({ ...ok, frames: [] })).toMatch(/Нет кадров/);
    expect(validateReferenceDoc({ ...ok, frames: [[0, 1, 2]] })).toMatch(/формат кадра/);
    expect(validateReferenceDoc({ ...ok, frames: [[0.5]] })).toMatch(/числа/);
    expect(validateReferenceDoc({ ...ok, frames: [[200], [100]] })).toMatch(/по порядку/);
    expect(validateReferenceDoc({ ...ok, frames: [[99999]] })).toMatch(/по порядку/);
  });
});
