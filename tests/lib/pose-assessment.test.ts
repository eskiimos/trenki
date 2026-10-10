import { describe, expect, it } from 'vitest';
import {
  accumulateAssessmentSample,
  assessmentSampleDuration,
  assessmentSummaryReliability,
  assessmentSettingsAt,
  createAssessmentAccumulator,
  evaluatePoseAssessment,
  prepareAssessmentReference,
  summarizeAssessment,
} from '../../src/lib/pose/assessment';
import { encodeFrame, LANDMARKS, LM, type Landmark, type PoseReferenceDoc } from '../../src/lib/pose/reference';
import { assessmentPreset } from '../../src/lib/pose/assessment-settings';
import type { Segment } from '../../src/lib/pose/segments';

type PointOverrides = Record<number, Partial<Landmark>>;

describe('assessment playback clock', () => {
  const previous = { mediaMs: 1000, capturedAtMs: 1000 };
  it('credits slow inference without granting an entire long gap to one pose', () => {
    expect(assessmentSampleDuration(previous, { mediaMs: 1900, capturedAtMs: 1900 }, 1)).toBe(500);
  });
  it('uses playing wall time when the video is slowed down', () => {
    expect(assessmentSampleDuration(previous, { mediaMs: 1100, capturedAtMs: 1200 }, 0.5)).toBe(200);
  });
  it('does not count a stalled or rewound playback clock', () => {
    expect(assessmentSampleDuration(previous, { mediaMs: 1000, capturedAtMs: 1100 }, 1)).toBe(0);
    expect(assessmentSampleDuration(previous, { mediaMs: 900, capturedAtMs: 1100 }, 1)).toBe(0);
  });
  it('rejects forward seeks and starts counting after the first fresh sample', () => {
    expect(assessmentSampleDuration(previous, { mediaMs: 8000, capturedAtMs: 1100 }, 1)).toBe(0);
    expect(assessmentSampleDuration(null, { mediaMs: 1000, capturedAtMs: 1000 }, 1)).toBe(0);
  });
});
function pose(tMs = 0, overrides: PointOverrides = {}, hidden: number[] = []): number[] {
  const landmarks: Landmark[] = Array.from({ length: LANDMARKS }, () => ({ x: 0.5, y: 0.5, visibility: 0.95 }));
  const world: Landmark[] = Array.from({ length: LANDMARKS }, () => ({ x: 0, y: 0, z: 0 }));
  const set = (id: number, x: number, y: number, z = 0) => { world[id] = { x, y, z }; };
  set(LM.lShoulder, 0.2, -0.5); set(LM.rShoulder, -0.2, -0.5);
  set(LM.lElbow, 0.2, -0.2); set(LM.rElbow, -0.2, -0.2);
  set(LM.lWrist, 0.2, 0.1); set(LM.rWrist, -0.2, 0.1);
  set(LM.lHip, 0.1, 0); set(LM.rHip, -0.1, 0);
  set(LM.lKnee, 0.1, 0.45); set(LM.rKnee, -0.1, 0.45);
  set(LM.lAnkle, 0.1, 0.9); set(LM.rAnkle, -0.1, 0.9);
  for (const [id, point] of Object.entries(overrides)) world[Number(id)] = { ...world[Number(id)]!, ...point };
  for (const id of hidden) landmarks[id]!.visibility = 0.1;
  return encodeFrame(tMs, landmarks, world);
}

function doc(frames: number[][] = [pose(0)], durationMs = 1000): PoseReferenceDoc {
  return { v: 1, model: 'pose_landmarker_heavy', fps: 10, width: 640, height: 360, durationMs, frames };
}
function reference(frames: number[][] = [pose(0)], segments: Segment[] = [{ startMs: 0, endMs: 1000 }]) {
  return prepareAssessmentReference(doc(frames), segments);
}
function set2d(frame: number[], id: number, change: { x?: number; y?: number; visibility?: number }): number[] {
  const out = [...frame];
  const offset = 1 + id * 3;
  if (change.x != null) out[offset] = Math.round(change.x * 1000);
  if (change.y != null) out[offset + 1] = Math.round(change.y * 1000);
  if (change.visibility != null) out[offset + 2] = Math.round(change.visibility * 100);
  return out;
}
function transformWorld(frame: number[], fn: (x: number, y: number, z: number) => [number, number, number]): number[] {
  const out = [...frame];
  for (let id = 0; id < LANDMARKS; id++) {
    const offset = 1 + LANDMARKS * 3 + id * 3;
    const [x, y, z] = fn(frame[offset]!, frame[offset + 1]!, frame[offset + 2]!);
    out.splice(offset, 3, Math.round(x), Math.round(y), Math.round(z));
  }
  return out;
}
function oppositePose(frame: number[]): number[] {
  const out = transformWorld(frame, (x, y, z) => [-x, y, z]);
  for (const [left, right] of [
    [LM.lShoulder, LM.rShoulder], [LM.lElbow, LM.rElbow], [LM.lWrist, LM.rWrist],
    [LM.lHip, LM.rHip], [LM.lKnee, LM.rKnee], [LM.lAnkle, LM.rAnkle],
  ]) {
    const lo = 1 + LANDMARKS * 3 + left! * 3;
    const ro = 1 + LANDMARKS * 3 + right! * 3;
    const leftPoint = out.slice(lo, lo + 3);
    out.splice(lo, 3, ...out.slice(ro, ro + 3));
    out.splice(ro, 3, ...leftPoint);
  }
  return out;
}

describe('synchronized pose assessment', () => {
  it('identical whole poses score 100 and report three body groups', () => {
    const result = evaluatePoseAssessment(reference(), pose(), 0, 'same');
    expect(result.status).toBe('scored');
    expect(result.score).toBe(100);
    expect(result.coverageRatio).toBe(1);
    expect(result.comparedAngles).toBe(9);
    expect(result.feedback.map((item) => item.group)).toEqual(['legs', 'arms', 'trunk']);
  });

  it('uses 3D angles rather than screen position, camera yaw or body size', () => {
    let camera = transformWorld(pose(), (x, y, z) => [z * 1.5 + 100, y * 1.5 + 200, -x * 1.5 - 100]);
    for (let id = 0; id < LANDMARKS; id++) camera = set2d(camera, id, { x: 0.2, y: 0.8 });
    const result = evaluatePoseAssessment(reference(), camera, 0, 'same');
    expect(result.score).toBe(100);
  });

  it('recognizes raised straight arms through shoulder angles', () => {
    const raised = pose(0, {
      [LM.lElbow]: { x: 0.2, y: -0.8 }, [LM.lWrist]: { x: 0.2, y: -1.1 },
      [LM.rElbow]: { x: -0.2, y: -0.8 }, [LM.rWrist]: { x: -0.2, y: -1.1 },
    });
    const result = evaluatePoseAssessment(reference(), raised, 0, 'same');
    expect(result.feedback.find((item) => item.group === 'arms')!.score).toBeLessThan(50);
    expect(result.angleErrors.find((item) => item.key === 'elbowL')!.score).toBe(100);
    expect(result.angleErrors.find((item) => item.key === 'shoulderL')!.score).toBe(0);
  });

  it('side matching is explicit and opposite is the default, not an automatic best-match search', () => {
    const asymmetric = pose(0, {
      [LM.lWrist]: { x: 0.5, y: -0.2 },
      [LM.lKnee]: { x: 0.1, y: 0, z: -0.45 },
      [LM.lAnkle]: { x: 0.1, y: 0.45, z: -0.45 },
    });
    const ref = reference([asymmetric]);
    const mirrored = oppositePose(asymmetric);
    expect(evaluatePoseAssessment(ref, mirrored, 0).score).toBe(100);
    expect(evaluatePoseAssessment(ref, mirrored, 0, 'same').score).toBeLessThan(80);
    expect(evaluatePoseAssessment(ref, asymmetric, 0, 'same').score).toBe(100);
    expect(evaluatePoseAssessment(ref, asymmetric, 0, 'opposite').score).toBeLessThan(80);
  });

  it('never searches ahead for a better matching pose', () => {
    const raised = pose(300, {
      [LM.lElbow]: { x: 0.2, y: -0.8 }, [LM.lWrist]: { x: 0.2, y: -1.1 },
      [LM.rElbow]: { x: -0.2, y: -0.8 }, [LM.rWrist]: { x: -0.2, y: -1.1 },
    });
    const result = evaluatePoseAssessment(reference([pose(0), raised]), raised, 0, 'same');
    expect(result.referenceTimeMs).toBe(0);
    expect(result.score).toBeLessThan(100);
  });

  it('uses nearest timestamp, preferring the earlier frame in a tie, only within 150ms', () => {
    const ref = reference([pose(0), pose(400)]);
    expect(evaluatePoseAssessment(ref, pose(), 150).referenceTimeMs).toBe(0);
    expect(evaluatePoseAssessment(ref, pose(), 151).status).toBe('reference_gap');
    expect(evaluatePoseAssessment(ref, pose(), 250).referenceTimeMs).toBe(400);
    const tie = reference([pose(0), pose(300)]);
    expect(evaluatePoseAssessment(tie, pose(), 150).referenceTimeMs).toBe(0);
  });

  it('does not score explanations, empty work annotations or frames crossing work boundaries', () => {
    const annotated = reference([pose(0), pose(200)], [{ startMs: 100, endMs: 900 }]);
    expect(evaluatePoseAssessment(annotated, pose(), 50).status).toBe('inactive');
    expect(evaluatePoseAssessment(annotated, pose(), 900).status).toBe('inactive');
    expect(evaluatePoseAssessment(annotated, pose(), 100).status).toBe('reference_gap');
    const empty = evaluatePoseAssessment(reference([pose()], []), pose(), 0);
    expect(empty.status).toBe('no_segments');
    expect(empty.score).toBeNull();
    expect(empty.message).toMatch(/разметьте/);
  });

  it('rejects invalid reference data and annotations before indexing', () => {
    expect(() => prepareAssessmentReference({ ...doc(), frames: [[500], [0]] }, [])).toThrow(/Неверный эталон/);
    expect(() => prepareAssessmentReference(doc(), [{ startMs: NaN, endMs: 500 }])).toThrow(/разметка/);
    const prepared = reference([pose()], [{ startMs: 500, endMs: 1500 }, { startMs: 0, endMs: 600 }]);
    expect(prepared.segments).toEqual([{ startMs: 0, endMs: 1000 }]);
  });

  it.each([NaN, Infinity, -1, 1000])('does not score time %s outside the lesson', (ms) => {
    expect(evaluatePoseAssessment(reference(), pose(), ms).status).toBe('out_of_range');
  });

  it('missing camera pose clears the score instead of keeping the previous good value', () => {
    const ref = reference();
    expect(evaluatePoseAssessment(ref, pose(), 0).score).toBe(100);
    const lost = evaluatePoseAssessment(ref, [0], 0);
    expect(lost.status).toBe('no_camera_pose');
    expect(lost.score).toBeNull();
    expect(lost.expectedWeight).toBeGreaterThan(0);
    expect(lost.coverageRatio).toBe(0);
    expect(lost.feedback).toEqual([]);
  });

  it('requires at least four visible matching angles and excludes clipped or uncertain joints', () => {
    const camera = pose(0, {}, [LM.lShoulder, LM.rShoulder]);
    const result = evaluatePoseAssessment(reference(), camera, 0, 'same');
    expect(result.status).toBe('insufficient_visibility');
    expect(result.comparedAngles).toBe(2);
    expect(result.score).toBeNull();
    const clipped = set2d(pose(), LM.lWrist, { x: 1.1 });
    expect(evaluatePoseAssessment(reference(), clipped, 0, 'same').angleErrors.some((error) => error.key === 'elbowL')).toBe(false);
    const uncertain = set2d(pose(), LM.lWrist, { visibility: 0.59 });
    expect(evaluatePoseAssessment(reference(), uncertain, 0, 'same').comparedAngles).toBe(8);
    const visible = set2d(pose(), LM.lWrist, { visibility: 0.6 });
    expect(evaluatePoseAssessment(reference(), visible, 0, 'same').comparedAngles).toBe(9);
  });

  it('marks missing and poorly visible reference poses separately from camera failure', () => {
    expect(evaluatePoseAssessment(reference([[0]]), pose(), 0).status).toBe('no_reference_pose');
    const lowVisibility = pose(0, {}, [LM.lShoulder, LM.rShoulder]);
    expect(evaluatePoseAssessment(reference([lowVisibility]), pose(), 0).status).toBe('no_reference_pose');
  });
});

describe('time and joint weighted session summary', () => {
  it('lost camera observations reduce total score and coverage without changing visible-pose similarity', () => {
    const ref = reference();
    const accumulator = createAssessmentAccumulator();
    accumulateAssessmentSample(accumulator, evaluatePoseAssessment(ref, pose(), 0), 100);
    accumulateAssessmentSample(accumulator, evaluatePoseAssessment(ref, [0], 0), 100);
    expect(summarizeAssessment(accumulator)).toEqual({
      score: 50, similarityScore: 100, coverageRatio: 0.5, activeMs: 200, scoredMs: 100, samples: 2,
      cameraMissingMs: 100, cameraPartialMs: 0, referenceUnavailableMs: 0, referenceCoverageRatio: 1,
    });
  });

  it('uses actual elapsed time instead of averaging sample counts', () => {
    const ref = reference();
    const accumulator = createAssessmentAccumulator();
    accumulateAssessmentSample(accumulator, evaluatePoseAssessment(ref, pose(), 0), 100);
    accumulateAssessmentSample(accumulator, evaluatePoseAssessment(ref, [0], 0), 300);
    expect(summarizeAssessment(accumulator).score).toBe(25);
    expect(summarizeAssessment(accumulator).coverageRatio).toBe(0.25);
  });

  it('does not penalize gaps, missing teacher poses or rest', () => {
    const accumulator = createAssessmentAccumulator();
    accumulateAssessmentSample(accumulator, evaluatePoseAssessment(reference(), pose(), 0), 100);
    accumulateAssessmentSample(accumulator, evaluatePoseAssessment(reference([[0]]), pose(), 0), 100);
    accumulateAssessmentSample(accumulator, evaluatePoseAssessment(reference([pose(0)]), pose(), 500), 100);
    accumulateAssessmentSample(accumulator, evaluatePoseAssessment(reference([pose()], []), pose(), 0), 100);
    accumulateAssessmentSample(accumulator, evaluatePoseAssessment(reference([pose()], [{ startMs: 500, endMs: 1000 }]), pose(), 0), 100);
    expect(summarizeAssessment(accumulator).score).toBe(100);
    expect(summarizeAssessment(accumulator).activeMs).toBe(100);
  });

  it('penalizes camera joint gaps while invisible reference joints are outside the denominator', () => {
    const partial = pose(0, {}, [LM.lWrist]);
    const fullReference = reference();
    const cameraPartial = evaluatePoseAssessment(fullReference, partial, 0, 'same');
    expect(cameraPartial.status).toBe('scored');
    expect(cameraPartial.comparedAngles).toBe(8);
    expect(cameraPartial.score).toBe(100);
    const accumulator = createAssessmentAccumulator();
    accumulateAssessmentSample(accumulator, cameraPartial, 100);
    expect(summarizeAssessment(accumulator).score).toBe(91);
    expect(summarizeAssessment(accumulator).coverageRatio).toBeCloseTo(7.75 / 8.5);

    const teacherPartial = evaluatePoseAssessment(reference([partial]), pose(), 0, 'same');
    const second = createAssessmentAccumulator();
    accumulateAssessmentSample(second, teacherPartial, 100);
    expect(summarizeAssessment(second).score).toBe(100);
    expect(summarizeAssessment(second).coverageRatio).toBe(1);
  });

  it('too few camera joints receive no credit, and a session with no scored frames has no score', () => {
    const camera = pose(0, {}, [LM.lShoulder, LM.rShoulder]);
    const accumulator = createAssessmentAccumulator();
    accumulateAssessmentSample(accumulator, evaluatePoseAssessment(reference(), camera, 0), 100);
    expect(summarizeAssessment(accumulator)).toEqual({
      score: null, similarityScore: null, coverageRatio: 0, activeMs: 100, scoredMs: 0, samples: 1,
      cameraMissingMs: 0, cameraPartialMs: 100, referenceUnavailableMs: 0, referenceCoverageRatio: 1,
    });
  });

  it('caps delayed observations and ignores nonpositive or invalid elapsed time', () => {
    const accumulator = createAssessmentAccumulator();
    const result = evaluatePoseAssessment(reference(), pose(), 0);
    for (const delta of [NaN, Infinity, -100, 0]) accumulateAssessmentSample(accumulator, result, delta);
    expect(summarizeAssessment(accumulator).activeMs).toBe(0);
    accumulateAssessmentSample(accumulator, result, 10000);
    expect(summarizeAssessment(accumulator).activeMs).toBe(500);
  });
});

describe('per-segment assessment profiles', () => {
  const withProfile = (profile: 'balanced' | 'legs' | 'arms' | 'core', frames = [pose()]) =>
    reference(frames, [{ startMs: 0, endMs: 1000, assessment: assessmentPreset(profile) }]);

  it('ignores disabled arms for a leg exercise and increases their impact for an arm exercise', () => {
    const wrongArm = pose(0, { [LM.lWrist]: { x: 0.6, y: -0.2 } });
    expect(evaluatePoseAssessment(withProfile('legs'), wrongArm, 0, 'same').score).toBe(100);
    const balanced = evaluatePoseAssessment(withProfile('balanced'), wrongArm, 0, 'same');
    const arms = evaluatePoseAssessment(withProfile('arms'), wrongArm, 0, 'same');
    expect(arms.score).toBeLessThan(balanced.score!);
    expect(arms.angleErrors.some((angle) => angle.key === 'kneeL')).toBe(false);
  });

  it('requires the important leg joints even when many other angles are visible', () => {
    const hiddenAnkle = pose(0, {}, [LM.lAnkle]);
    expect(evaluatePoseAssessment(withProfile('legs'), hiddenAnkle, 0, 'same').status).toBe('insufficient_visibility');
    expect(evaluatePoseAssessment(withProfile('arms'), hiddenAnkle, 0, 'same').status).toBe('scored');
    expect(evaluatePoseAssessment(withProfile('legs', [hiddenAnkle]), pose(), 0, 'same').status).toBe('no_reference_pose');
  });

  it('allows a core-only profile to compare its one required angle', () => {
    const hiddenLegs = pose(0, {}, [LM.lKnee, LM.rKnee, LM.lWrist, LM.rWrist]);
    const result = evaluatePoseAssessment(withProfile('core'), hiddenLegs, 0, 'same');
    expect(result.status).toBe('scored');
    expect(result.comparedAngles).toBe(1);
    expect(result.score).toBe(100);
  });

  it('maps unilateral required joints to the chosen side mode', () => {
    const settings = assessmentPreset('core');
    settings.profile = 'custom'; settings.weights.trunk = 0; settings.weights.kneeL = 1; settings.requiredAngles = ['kneeL'];
    const ref = reference([pose()], [{ startMs: 0, endMs: 1000, assessment: settings }]);
    const rightHidden = pose(0, {}, [LM.rAnkle]);
    expect(evaluatePoseAssessment(ref, rightHidden, 0, 'same').score).toBe(100);
    expect(evaluatePoseAssessment(ref, rightHidden, 0, 'opposite').score).toBeNull();
  });

  it('applies the configured tolerance and keeps the shape beyond the noise floor', () => {
    const radians = 20 * Math.PI / 180;
    const camera = pose(0, { [LM.lWrist]: { x: 0.2 + 0.3 * Math.sin(radians), y: -0.2 + 0.3 * Math.cos(radians) } });
    const tolerant = assessmentPreset(); tolerant.toleranceDeg = 25;
    expect(evaluatePoseAssessment(withProfile('balanced'), camera, 0, 'same').score).toBeLessThan(100);
    expect(evaluatePoseAssessment(reference([pose()], [{ startMs: 0, endMs: 1000, assessment: tolerant }]), camera, 0, 'same').score).toBe(100);
  });

  it('never borrows a teacher frame from an adjacent different exercise', () => {
    const ref = reference([pose(400), pose(700)], [
      { startMs: 0, endMs: 500, assessment: assessmentPreset('legs') },
      { startMs: 500, endMs: 1000, assessment: assessmentPreset('arms') },
    ]);
    expect(evaluatePoseAssessment(ref, pose(), 500, 'same').status).toBe('reference_gap');
    expect(assessmentSettingsAt(ref, 100).profile).toBe('legs');
    expect(assessmentSettingsAt(ref, 600).profile).toBe('arms');
  });

  it('selects the next work profile while the trainer is explaining', () => {
    const ref = reference([pose()], [{ startMs: 500, endMs: 1000, assessment: assessmentPreset('arms') }]);
    expect(assessmentSettingsAt(ref, 0).profile).toBe('arms');
  });
});

describe('overall result reliability', () => {
  const good = () => evaluatePoseAssessment(reference(), pose(), 0, 'same');
  const credit = (accumulator: ReturnType<typeof createAssessmentAccumulator>, sample: ReturnType<typeof good>, count: number) => {
    for (let i = 0; i < count; i++) accumulateAssessmentSample(accumulator, sample, 500);
  };
  it('does not endorse a perfect percentage from a short observation', () => {
    const acc = createAssessmentAccumulator(); credit(acc, good(), 5);
    expect(summarizeAssessment(acc).score).toBe(100);
    expect(assessmentSummaryReliability(summarizeAssessment(acc)).reliable).toBe(false);
    credit(acc, good(), 1);
    expect(assessmentSummaryReliability(summarizeAssessment(acc)).reliable).toBe(true);
  });
  it('separates low movement similarity from poor observation quality', () => {
    const acc = createAssessmentAccumulator(); credit(acc, { ...good(), score: 0 }, 6);
    expect(summarizeAssessment(acc).score).toBe(0);
    expect(assessmentSummaryReliability(summarizeAssessment(acc)).reliable).toBe(true);
  });
  it('keeps camera losses in the denominator and exposes their duration', () => {
    const acc = createAssessmentAccumulator(); credit(acc, good(), 6);
    credit(acc, evaluatePoseAssessment(reference(), [0], 0), 6);
    const summary = summarizeAssessment(acc);
    expect(summary).toMatchObject({ score: 50, similarityScore: 100, cameraMissingMs: 3000, coverageRatio: 0.5 });
    expect(assessmentSummaryReliability(summary).reliable).toBe(false);
  });
  it('does not endorse a result computed from a tiny usable part of the teacher reference', () => {
    const acc = createAssessmentAccumulator(); credit(acc, good(), 6);
    credit(acc, evaluatePoseAssessment(reference([[0]]), pose(), 0), 6);
    const summary = summarizeAssessment(acc);
    expect(summary.score).toBe(100);
    expect(summary.referenceCoverageRatio).toBe(0.5);
    expect(summary.referenceUnavailableMs).toBe(3000);
    expect(assessmentSummaryReliability(summary).message).toMatch(/эталона/);
  });
});
