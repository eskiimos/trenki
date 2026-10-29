import { describe, expect, it } from 'vitest';
import { assessmentPreset, parseAssessmentSettings } from '@/lib/pose/assessment-settings';
import { normalizeSegments, parseSegments } from '@/lib/pose/segments';

describe('persistent exercise assessment rules', () => {
  it('saves a disabled segment after all joints were excluded, but requires joints when re-enabled', () => {
    const disabled = { ...assessmentPreset(), enabled: false, weights: Object.fromEntries(Object.keys(assessmentPreset().weights).map((key) => [key, 0])), requiredAngles: [] };
    expect(parseAssessmentSettings(disabled)?.enabled).toBe(false);
    expect(parseAssessmentSettings({ ...disabled, enabled: true })).toBeNull();
  });
  it.each(['balanced', 'legs', 'arms', 'core'] as const)('validates preset %s without shared mutable weights', (profile) => {
    const preset = assessmentPreset(profile);
    expect(parseAssessmentSettings(preset)).toEqual(preset);
    preset.weights.trunk = 0;
    expect(assessmentPreset(profile).weights.trunk).toBeGreaterThan(0);
  });
  it.each([null, {}, { ...assessmentPreset(), profile: 'unknown' }, { ...assessmentPreset(), toleranceDeg: Infinity },
    { ...assessmentPreset(), toleranceDeg: 31 }, { ...assessmentPreset(), requiredAngles: [] },
    { ...assessmentPreset('legs'), requiredAngles: ['elbowL'] },
    { ...assessmentPreset(), weights: { ...assessmentPreset().weights, trunk: -1 } },
    { ...assessmentPreset(), weights: { ...assessmentPreset().weights, trunk: 6 } },
    { ...assessmentPreset(), weights: { ...assessmentPreset().weights, imaginary: 1 } },
  ])('rejects invalid settings rather than silently applying a default (%j)', (input) => {
    expect(parseAssessmentSettings(input)).toBeNull();
  });
  it('preserves old time-only annotations and custom settings through normalization and JSON', () => {
    const rules = { ...assessmentPreset('legs'), toleranceDeg: 12 };
    const input = [{ startMs: 1000, endMs: 500, assessment: rules }, { startMs: 1500, endMs: 2000 }];
    const expected = [{ startMs: 500, endMs: 1000, assessment: rules }, { startMs: 1500, endMs: 2000 }];
    expect(parseSegments(JSON.parse(JSON.stringify(input)), 3000)).toEqual(expected);
    expect(normalizeSegments(expected, 3000)).toEqual(expected);
  });
  it('keeps adjacent different profiles distinct and rejects conflicting overlapping profiles', () => {
    const legs = { startMs: 0, endMs: 1000, assessment: assessmentPreset('legs') };
    const arms = { startMs: 1000, endMs: 2000, assessment: assessmentPreset('arms') };
    expect(parseSegments([legs, arms], 2000)).toHaveLength(2);
    expect(parseSegments([legs, { ...arms, startMs: 999 }], 2000)).toBeNull();
    expect(parseSegments([legs, { ...legs, startMs: 800, endMs: 1500 }], 2000)).toEqual([{ ...legs, endMs: 1500 }]);
  });
  it('rejects invalid attached settings instead of dropping them', () => {
    expect(parseSegments([{ startMs: 0, endMs: 1000, assessment: null }], 1000)).toBeNull();
  });
});
