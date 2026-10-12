import { describe, expect, it } from 'vitest';
import { editSegmentRange, formatSegmentTime, moveSegmentBoundary, parseSegmentTime } from '../../src/lib/pose/segment-editor';
import { assessmentPreset } from '../../src/lib/pose/assessment-settings';
import { MAX_SEGMENTS } from '../../src/lib/pose/segments';

describe('exact segment time', () => {
  it.each([['0', 0], ['83.5', 83500], ['83,500', 83500], ['1:23.005', 83005], [' 0:00,001 ', 1], ['125:59.999', 7559999]])('parses %s without rounding to seconds', (value, ms) => {
    expect(parseSegmentTime(value)).toBe(ms);
    expect(parseSegmentTime(formatSegmentTime(ms))).toBe(ms);
  });
  it.each(['', '-1', '1:60', '1:2', '1:02:03', '1e3', 'Infinity', 'NaN', '1.0001', '1,2.3', '9007199254740991'])('rejects invalid time %s', (value) => {
    expect(parseSegmentTime(value)).toBeNull();
  });
  it('shows milliseconds rather than rounding boundaries', () => {
    expect(formatSegmentTime(59999)).toBe('0:59.999');
    expect(formatSegmentTime(60001)).toBe('1:00.001');
  });
});

describe('manual segment edits', () => {
  const assessment = assessmentPreset('legs');
  const initial = [{ startMs: 1000, endMs: 5000, assessment }, { startMs: 10000, endMs: 15000 }];
  it('preserves assessment settings and sorts a moved segment', () => {
    const result = editSegmentRange(initial, 0, 20001, 25005, 30000);
    expect(result).toEqual({ segments: [initial[1], { startMs: 20001, endMs: 25005, assessment }], selectedIndex: 1 });
    expect(initial[0].startMs).toBe(1000);
  });
  it.each([[6000, 5000], [6000, 6499], [-1, 5000], [20000, 30001], [4000, 11000], [NaN, 5000], [1000.5, 5000]])('rejects invalid boundaries %s — %s', (start, end) => {
    expect(editSegmentRange(initial, 0, start, end, 30000)).toHaveProperty('error');
  });
  it('allows 500ms and boundaries at the ends of the video', () => {
    expect(editSegmentRange([], null, 0, 500, 500)).toEqual({ segments: [{ startMs: 0, endMs: 500 }], selectedIndex: 0 });
  });
  it('adds into an empty reference and rejects overlapping additions', () => {
    expect(editSegmentRange([], null, 1000, 5000, 30000)).toHaveProperty('segments');
    expect(editSegmentRange(initial, null, 2000, 3000, 30000)).toHaveProperty('error');
  });
  it('allows touching different profiles without losing settings', () => {
    const result = editSegmentRange(initial, 0, 5000, 10000, 30000);
    expect(result).toEqual({ segments: [{ startMs: 5000, endMs: 10000, assessment }, initial[1]], selectedIndex: 0 });
  });
  it('selects the merged range when identical settings touch', () => {
    expect(editSegmentRange([{ startMs: 0, endMs: 1000 }], null, 1000, 2000, 30000)).toEqual({ segments: [{ startMs: 0, endMs: 2000 }], selectedIndex: 0 });
  });
  it('enforces the API segment limit and handles stale selection', () => {
    const many = Array.from({ length: MAX_SEGMENTS }, (_, i) => ({ startMs: i * 2000, endMs: i * 2000 + 500 }));
    expect(editSegmentRange(many, null, 500000, 501000, 600000)).toHaveProperty('error');
    expect(editSegmentRange(initial, 5, 20000, 25000, 30000)).toHaveProperty('error');
  });
  it('clamps dragging to neighbors and minimum duration while preserving profiles', () => {
    expect(moveSegmentBoundary(initial, 0, 'start', 7000, 30000)[0]).toEqual({ startMs: 4500, endMs: 5000, assessment });
    expect(moveSegmentBoundary(initial, 0, 'end', 12000, 30000)[0]).toEqual({ startMs: 1000, endMs: 10000, assessment });
    expect(moveSegmentBoundary(initial, 1, 'start', 0, 30000)[1].startMs).toBe(5000);
    expect(moveSegmentBoundary(initial, 1, 'end', 40000, 30000)[1].endMs).toBe(30000);
  });
});
