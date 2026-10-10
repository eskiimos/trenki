import { describe, expect, it } from 'vitest';
import { encodeFrame, LM, type Landmark } from '@/lib/pose/reference';
import { assessmentPreset } from '@/lib/pose/assessment-settings';
import { advanceReadiness, checkAssessmentReadiness, initialReadiness } from '@/lib/pose/readiness';

function camera(hidden: number[] = [], clipped = false) {
  const landmarks: Landmark[] = Array.from({ length: 33 }, (_, id) => ({ x: clipped && id === LM.lAnkle ? 0.99 : 0.5, y: 0.5, visibility: hidden.includes(id) ? 0.1 : 0.95 }));
  const world = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0 }));
  for (const [id, x, y] of [[11,.2,-.5],[12,-.2,-.5],[13,.2,-.2],[14,-.2,-.2],[15,.2,.1],[16,-.2,.1],[23,.1,0],[24,-.1,0],[25,.1,.45],[26,-.1,.45],[27,.1,.9],[28,-.1,.9]]) world[id!] = { x: x!, y: y!, z: 0 };
  return encodeFrame(0, landmarks, world);
}
const good = { good: true, message: 'Visible' };
function readyGate() {
  let gate = initialReadiness();
  for (let t = 0; t <= 3000; t += 200) gate = advanceReadiness(gate, good, t, 'legs:same');
  return gate;
}

describe('camera preparation', () => {
  it('checks the selected profile, not unrelated limbs or similarity to the trainer', () => {
    const hiddenAnkles = camera([LM.lAnkle, LM.rAnkle]);
    expect(checkAssessmentReadiness(hiddenAnkles, assessmentPreset('legs'), 'same').good).toBe(false);
    expect(checkAssessmentReadiness(hiddenAnkles, assessmentPreset('arms'), 'same').good).toBe(true);
    expect(checkAssessmentReadiness(camera(), assessmentPreset(), 'same').good).toBe(true);
  });
  it('explains missing people and joints near the edge of the image', () => {
    expect(checkAssessmentReadiness([0], assessmentPreset(), 'same').message).toMatch(/не видит/);
    expect(checkAssessmentReadiness(camera([], true), assessmentPreset(), 'same').message).toMatch(/краю кадра/);
  });
  it('requires three continuous seconds of fresh observations', () => {
    const first = advanceReadiness(initialReadiness(), good, 0, 'legs:same');
    expect(first.secondsLeft).toBe(3); expect(first.ready).toBe(false);
    expect(readyGate().ready).toBe(true);
  });
  it('resets immediately after a missing pose, even after readiness was reached', () => {
    const gate = advanceReadiness(readyGate(), { good: false, message: 'Missing knee' }, 3200, 'legs:same');
    expect(gate.ready).toBe(false); expect(gate.sinceMs).toBeNull(); expect(gate.message).toBe('Missing knee');
  });
  it('does not let a stale observation or frozen timestamp unlock the start button', () => {
    const first = advanceReadiness(initialReadiness(), good, 0, 'legs:same');
    expect(advanceReadiness(first, good, 4000, 'legs:same').ready).toBe(false);
    expect(advanceReadiness(readyGate(), good, 3000, 'legs:same').ready).toBe(false);
    expect(advanceReadiness(readyGate(), good, NaN, 'legs:same').ready).toBe(false);
  });
  it('requires a new countdown when the profile or side mode changes', () => {
    const changed = advanceReadiness(readyGate(), good, 3200, 'arms:opposite');
    expect(changed.ready).toBe(false); expect(changed.secondsLeft).toBe(3);
  });
});
