import { describe, expect, it } from 'vitest';
import { assessmentPreset } from '@/lib/pose/assessment-settings';
import { playbackRepeatSegments } from '@/lib/training/repeat-settings';

const repeat = { enabled: true, seekToMs: 1000, promptDelayMs: 7000, promptDurationMs: 5000 };
const segment = { startMs: 10000, endMs: 20000, repeat };
const reference = (segments: unknown) => ({ durationSec: 60, segments });

describe('ordinary-player repeat metadata', () => {
  it('returns enabled exercise boundaries and explicit repeat timings, without biomechanics', () => {
    const exercise = { ...segment, assessment: assessmentPreset('legs') };
    const disabledExercise = { startMs: 30000, endMs: 40000, assessment: { ...assessmentPreset(), enabled: false }, repeat };
    const disabledRepeat = { startMs: 45000, endMs: 50000, repeat: { ...repeat, enabled: false } };
    const unconfigured = { startMs: 55000, endMs: 60000 };
    expect(playbackRepeatSegments(reference([exercise, disabledExercise, disabledRepeat, unconfigured]))).toEqual([
      segment,
      { startMs: disabledRepeat.startMs, endMs: disabledRepeat.endMs },
      unconfigured,
    ]);
  });

  it('keeps the following non-repeat set so it can cancel an earlier delayed offer', () => {
    const following = { startMs: 22000, endMs: 35000 };
    expect(playbackRepeatSegments(reference([segment, following]))).toEqual([segment, following]);
    expect(playbackRepeatSegments(reference([following]))).toEqual([]);
    expect(playbackRepeatSegments(reference([{ ...segment, repeat: { ...repeat, enabled: false } }, following]))).toEqual([]);
  });

  it('preserves a valid millisecond end within the reference summary rounding interval', () => {
    const exact = { ...segment, endMs: 12847 };
    expect(playbackRepeatSegments({ durationSec: 12.8, segments: [exact] })).toEqual([exact]);
    expect(playbackRepeatSegments({ durationSec: 12.8, segments: [{ ...exact, endMs: 12850 }] })).toEqual([{ ...exact, endMs: 12850 }]);
    expect(playbackRepeatSegments({ durationSec: 12.8, segments: [{ ...exact, endMs: 12851 }] })).toEqual([]);
  });

  it('does not require camera frames or a global tracking override for an explicitly configured exercise', () => {
    expect(playbackRepeatSegments(reference([segment]))).toEqual([segment]);
    expect(playbackRepeatSegments(null)).toEqual([]);
    expect(playbackRepeatSegments(reference(null))).toEqual([]);
  });

  it.each([
    [{ ...segment, endMs: 61000 }],
    [{ ...segment, startMs: -100 }],
    [{ ...segment, startMs: 20000, endMs: 10000 }],
    [{ ...segment, startMs: Number.NaN }],
    [{ ...segment, repeat: { ...repeat, seekToMs: 11000 } }],
    [{ ...segment, repeat: { ...repeat, promptDurationMs: 0 } }],
    [segment, { ...segment, startMs: 15000, endMs: 25000, repeat: { ...repeat, seekToMs: 0 } }],
  ].map((segments) => ({ segments })))('fails closed on corrupt saved reference metadata $segments', ({ segments }) => {
    expect(playbackRepeatSegments(reference(segments))).toEqual([]);
  });

  it('bounds metadata volume and rejects invalid reference duration', () => {
    expect(playbackRepeatSegments(reference(Array.from({ length: 201 }, () => segment)))).toEqual([]);
    expect(playbackRepeatSegments({ durationSec: Infinity, segments: [segment] })).toEqual([]);
    expect(playbackRepeatSegments({ durationSec: 0, segments: [segment] })).toEqual([]);
  });
});
