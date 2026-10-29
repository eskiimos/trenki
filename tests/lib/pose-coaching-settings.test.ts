import { describe, expect, it } from 'vitest';
import { defaultSegmentRepeat, effectiveVideoTrackingEnabled, isTheoryVideo, parseSegmentRepeat } from '@/lib/pose/coaching-settings';
import { assessmentPreset, parseAssessmentSettings, visibleAssessmentPoints } from '@/lib/pose/assessment-settings';
import { normalizeSegments, parseSegments } from '@/lib/pose/segments';
import { accumulateAssessmentSample, assessmentSettingsAt, createAssessmentAccumulator, evaluatePoseAssessment, prepareAssessmentReference } from '@/lib/pose/assessment';
import { LM } from '@/lib/pose/reference';
import { editSegmentRange, moveSegmentBoundary } from '@/lib/pose/segment-editor';

describe('video biomechanics policy', () => {
  it.each([['теория'], [' THEORY '], ['ТЕОРИЯ', 'хоккей']])('detects explicit theory tags %j', (...tags) => {
    expect(isTheoryVideo(tags)).toBe(true);
    expect(effectiveVideoTrackingEnabled(null, tags)).toBe(false);
  });
  it('leaves existing untagged and unrelated/tactical videos enabled', () => {
    expect(effectiveVideoTrackingEnabled(undefined)).toBe(true);
    expect(isTheoryVideo(['тактика', 'теория хоккея', 'no-theory'])).toBe(false);
  });
  it('honors both explicit overrides over automatic tags', () => {
    expect(effectiveVideoTrackingEnabled(true, ['теория'])).toBe(true);
    expect(effectiveVideoTrackingEnabled(false, ['техника'])).toBe(false);
  });
});

describe('per-segment disabled tracking', () => {
  const disabled = { ...assessmentPreset('legs'), enabled: false };
  it('roundtrips disabled settings without discarding joint configuration', () => {
    expect(parseAssessmentSettings(JSON.parse(JSON.stringify(disabled)))).toEqual(disabled);
    expect(parseAssessmentSettings({ ...disabled, enabled: null })).toBeNull();
    expect(parseAssessmentSettings({ ...disabled, requiredAngles: [] })).toEqual({ ...disabled, requiredAngles: [] });
    expect(parseAssessmentSettings({ ...disabled, enabled: true, requiredAngles: [] })).toBeNull();
  });
  it('keeps legacy settings unchanged and enabled=true explicit', () => {
    expect(parseAssessmentSettings(assessmentPreset())).not.toHaveProperty('enabled');
    expect(parseAssessmentSettings({ ...assessmentPreset(), enabled: true })).toHaveProperty('enabled', true);
  });
  it('returns inactive before checking missing teacher/camera pose and never credits scored work', () => {
    const reference = prepareAssessmentReference({ v: 1, model: 'pose_landmarker_heavy', fps: 10, durationMs: 1000, width: 640, height: 480, frames: [[0]] }, [{ startMs: 0, endMs: 1000, assessment: disabled }]);
    const result = evaluatePoseAssessment(reference, [0], 0);
    expect(result).toMatchObject({ status: 'inactive', score: null, comparedAngles: 0 });
    const accumulator = createAssessmentAccumulator();
    accumulateAssessmentSample(accumulator, result, 500);
    expect(accumulator.activeMs).toBe(0);
    expect(assessmentSettingsAt(reference, 0).enabled).toBe(false);
  });
  it('preserves shared shoulder/hip points while excluding hand/elbow points for a legs profile', () => {
    const points = visibleAssessmentPoints(assessmentPreset('legs'));
    expect(points).toContain(LM.lShoulder);
    expect(points).toContain(LM.rHip);
    expect(points).not.toContain(LM.lElbow);
    expect(points).not.toContain(LM.rWrist);
    expect(visibleAssessmentPoints(disabled)).toEqual([]);
  });
  it('maps a unilateral angle to the opposite body side for mirrored imitation', () => {
    const one = assessmentPreset();
    for (const key of Object.keys(one.weights) as Array<keyof typeof one.weights>) one.weights[key] = key === 'elbowL' ? 1 : 0;
    one.requiredAngles = ['elbowL'];
    expect(visibleAssessmentPoints(one)).toEqual([LM.lShoulder, LM.lElbow, LM.lWrist]);
    expect(visibleAssessmentPoints(one, 'opposite')).toEqual([LM.rShoulder, LM.rElbow, LM.rWrist]);
  });
});

describe('repeat setup persistence', () => {
  const repeat = { ...defaultSegmentRepeat(20000), enabled: true };
  it('defaults to 7-second delay, 5-second offer and 15-second preroll clipped at start', () => {
    expect(repeat).toEqual({ enabled: true, seekToMs: 5000, promptDelayMs: 7000, promptDurationMs: 5000 });
    expect(defaultSegmentRepeat(5000).seekToMs).toBe(0);
  });
  it.each([
    null, {}, [], { ...repeat, enabled: 'true' }, { ...repeat, seekToMs: -1 }, { ...repeat, seekToMs: 20001 },
    { ...repeat, seekToMs: 1.5 }, { ...repeat, promptDelayMs: -1 }, { ...repeat, promptDelayMs: 30001 },
    { ...repeat, promptDurationMs: 999 }, { ...repeat, promptDurationMs: 15001 }, { ...repeat, promptDurationMs: Infinity },
  ])('rejects unsafe or out-of-bound repeat setup %j', (value) => {
    expect(parseSegmentRepeat(value, 20000)).toBeNull();
  });
  it('retains repeat settings through JSON, normalization and range edits', () => {
    const segment = { startMs: 20000, endMs: 30000, assessment: assessmentPreset('legs'), repeat };
    expect(parseSegments(JSON.parse(JSON.stringify([segment])), 40000)).toEqual([segment]);
    expect(normalizeSegments([segment], 40000)).toEqual([segment]);
    expect(editSegmentRange([segment], 0, 18000, 28000, 40000)).toMatchObject({ segments: [{ ...segment, startMs: 18000, endMs: 28000 }] });
    expect(editSegmentRange([segment], 0, 4000, 28000, 40000)).toHaveProperty('error');
    expect(moveSegmentBoundary([segment], 0, 'start', 0, 40000)[0].startMs).toBe(5000);
  });
  it('does not merge adjacent sets when their repeat policy differs', () => {
    const first = { startMs: 10000, endMs: 20000, repeat: { ...repeat, seekToMs: 0 } };
    const second = { startMs: 20000, endMs: 30000, repeat };
    expect(parseSegments([first, second], 40000)).toHaveLength(2);
    expect(parseSegments([first, { ...second, startMs: 19000 }], 40000)).toBeNull();
    expect(parseSegments([{ ...first, repeat: null }], 40000)).toBeNull();
  });
  it('validates return time against the normalized earlier boundary for historical reversed inputs', () => {
    expect(parseSegments([{ startMs: 30000, endMs: 20000, repeat }], 40000)).toEqual([{ startMs: 20000, endMs: 30000, repeat }]);
    expect(parseSegments([{ startMs: 30000, endMs: 20000, repeat: { ...repeat, seekToMs: 25000 } }], 40000)).toBeNull();
  });
});
