import { describe, expect, it } from 'vitest';
import { createTrainingGuardState, evaluateTrainingGuard, resetTrainingGuard } from '../../src/lib/pose/training-guard';
import { assessmentPreset } from '../../src/lib/pose/assessment-settings';
import { encodeFrame, LANDMARKS, LM, type Landmark } from '../../src/lib/pose/reference';

function pose(time: number, knee = 180, arm = 0, hidden: number[] = []) {
  const landmarks: Landmark[] = Array.from({ length: LANDMARKS }, () => ({ x: 0.5, y: 0.5, visibility: 0.95 }));
  const world: Landmark[] = Array.from({ length: LANDMARKS }, () => ({ x: 0, y: 0, z: 0 }));
  const set = (id: number, x: number, y: number, z = 0) => { world[id] = { x, y, z }; };
  set(LM.lShoulder, 0.2, -0.5); set(LM.rShoulder, -0.2, -0.5);
  set(LM.lElbow, 0.2, -0.2); set(LM.rElbow, -0.2, -0.2);
  set(LM.lWrist, 0.2, 0.1, arm); set(LM.rWrist, -0.2, 0.1, arm);
  set(LM.lHip, 0.1, 0); set(LM.rHip, -0.1, 0);
  set(LM.lKnee, 0.1, 0.45); set(LM.rKnee, -0.1, 0.45);
  const rad = (180 - knee) * Math.PI / 180;
  set(LM.lAnkle, 0.1, 0.45 + 0.45 * Math.cos(rad), 0.45 * Math.sin(rad));
  set(LM.rAnkle, -0.1, 0.45 + 0.45 * Math.cos(rad), 0.45 * Math.sin(rad));
  hidden.forEach(id => { landmarks[id].visibility = 0.1; });
  return encodeFrame(time, landmarks, world);
}
const moving = (time: number) => 130 + 45 * Math.sin(time / 250);
const rules = assessmentPreset('legs');

describe('reference-aware training auto pause', () => {
  it('pauses after five confirmed still seconds while the enabled teacher joints move', () => {
    const state = createTrainingGuardState();
    let result;
    for (let t = 0; t <= 5500; t += 100) {
      result = evaluateTrainingGuard(state, { cameraFrame: pose(t), referenceFrame: pose(t, moving(t)), settings: rules, timestampMs: t, mediaMs: t, enabled: true, signature: 'set-1' });
      expect(result.reason).toBeNull();
    }
    result = evaluateTrainingGuard(state, { cameraFrame: pose(5600), referenceFrame: pose(5600, moving(5600)), settings: rules, timestampMs: 5600, mediaMs: 5600, enabled: true, signature: 'set-1' });
    expect(result.reason).toBe('stationary');
    expect(result.stationaryMs).toBe(5000);
  });
  it('does not mistake static holds and small reference jitter for stopping', () => {
    const state = createTrainingGuardState();
    for (let t = 0; t <= 10000; t += 200) {
      const result = evaluateTrainingGuard(state, { cameraFrame: pose(t, 100), referenceFrame: pose(t, 100 + Math.sin(t)), settings: rules, timestampMs: t, mediaMs: t, enabled: true, signature: 'hold' });
      expect(result.reason).toBeNull();
      expect(result.stationaryMs).toBe(0);
    }
  });
  it('ignores arm gestures when only legs and trunk are enabled', () => {
    const state = createTrainingGuardState();
    for (let t = 0; t <= 10000; t += 200) {
      const result = evaluateTrainingGuard(state, { cameraFrame: pose(t), referenceFrame: pose(t, 180, Math.sin(t / 200)), settings: rules, timestampMs: t, mediaMs: t, enabled: true, signature: 'legs' });
      expect(result.reason).toBeNull();
      expect(result.referenceMoving).toBe(false);
    }
  });
  it('keeps playing when the athlete keeps moving, even with a different phase', () => {
    const state = createTrainingGuardState();
    for (let t = 0; t <= 10000; t += 100) {
      const result = evaluateTrainingGuard(state, { cameraFrame: pose(t, moving(t + 400)), referenceFrame: pose(t, moving(t)), settings: rules, timestampMs: t, mediaMs: t, enabled: true, signature: 'moving' });
      expect(result.reason).toBeNull();
    }
  });
  it('allows sensor jitter below the learner motion threshold without resetting stillness', () => {
    const state = createTrainingGuardState();
    let reason;
    for (let t = 0; t <= 6000; t += 100) {
      reason = evaluateTrainingGuard(state, { cameraFrame: pose(t, 175 + Math.sin(t / 80)), referenceFrame: pose(t, moving(t)), settings: rules, timestampMs: t, mediaMs: t, enabled: true, signature: 'jitter' }).reason;
    }
    expect(reason).toBe('stationary');
  });
  it('debounces a missing person and resets when the person comes back', () => {
    const state = createTrainingGuardState();
    const run = (t: number, missing: boolean) => evaluateTrainingGuard(state, { cameraFrame: missing ? [t] : pose(t), referenceFrame: pose(t, moving(t)), settings: rules, timestampMs: t, mediaMs: t, enabled: true, signature: 'set' });
    expect(run(0, true).reason).toBeNull(); expect(run(900, true).reason).toBeNull();
    expect(run(1000, true).reason).toBe('missing');
    expect(run(1100, false).missingMs).toBe(0);
    expect(run(1200, true).reason).toBeNull();
  });
  it('requires visible enabled joints, while ignored arms may be out of the image', () => {
    const state = createTrainingGuardState();
    const base = { settings: rules, enabled: true, signature: 'visibility' };
    expect(evaluateTrainingGuard(state, { ...base, cameraFrame: pose(0, 180, 0, [LM.lWrist, LM.rWrist]), referenceFrame: pose(0), timestampMs: 0, mediaMs: 0 }).reason).toBeNull();
    for (let t = 100; t <= 1100; t += 100) {
      const result = evaluateTrainingGuard(state, { ...base, cameraFrame: pose(t, 180, 0, [LM.lAnkle]), referenceFrame: pose(t), timestampMs: t, mediaMs: t });
      if (t === 1100) expect(result.reason).toBe('missing');
    }
  });
  it('resets for disabled theory/rest, segment changes, seeks, buffer gaps and explicit resets', () => {
    const state = createTrainingGuardState();
    const run = (t: number, media = t, enabled = true, signature = 'first') => evaluateTrainingGuard(state, { cameraFrame: [t], settings: rules, timestampMs: t, mediaMs: media, enabled, signature });
    run(0); run(900); expect(run(1000, 1000, false).reason).toBeNull();
    expect(run(1100).missingMs).toBe(0);
    expect(run(1200, 1200, true, 'next').missingMs).toBe(0);
    expect(run(1300, 5000).missingMs).toBe(0);
    expect(run(4000, 7700).missingMs).toBe(0);
    resetTrainingGuard(state); expect(state.previous).toBeNull();
    const disabled = { ...rules, enabled: false };
    expect(evaluateTrainingGuard(state, { cameraFrame: [0], settings: disabled, timestampMs: 0, mediaMs: 0, enabled: true, signature: 'disabled' }).reason).toBeNull();
    expect(state.previous).toBeNull();
  });
  it('does not infer stopping from stale or unusable reference frames', () => {
    const state = createTrainingGuardState();
    for (let t = 0; t <= 10000; t += 200) {
      expect(evaluateTrainingGuard(state, { cameraFrame: pose(t), referenceFrame: pose(0, moving(t)), settings: rules, timestampMs: t, mediaMs: t, enabled: true, signature: 'bad-reference' }).reason).toBeNull();
    }
  });
  it('uses wall time at half-speed instead of counting slowed media seconds', () => {
    const state = createTrainingGuardState();
    const run = (t: number) => evaluateTrainingGuard(state, { cameraFrame: [t], settings: rules, timestampMs: t, mediaMs: t / 2, playbackRate: 0.5, enabled: true, signature: 'slow' });
    run(0); run(500); expect(run(1000).reason).toBe('missing');
  });
});
