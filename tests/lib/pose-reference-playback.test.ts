import { describe, expect, it } from 'vitest';
import { clampReferenceSeek } from '../../src/lib/pose/reference-playback';

describe('admin reference playback bounds', () => {
  it('keeps exact milliseconds inside the reference', () => {
    expect(clampReferenceSeek(80123, 120000, 435)).toBe(80123);
  });
  it('clamps backward and forward seeks to the reference', () => {
    expect(clampReferenceSeek(-4875, 120000, 435)).toBe(0);
    expect(clampReferenceSeek(124875, 120000, 435)).toBe(120000);
  });
  it('does not seek beyond a shorter actual video', () => {
    expect(clampReferenceSeek(120000, 120000, 90.125)).toBe(90125);
  });
  it.each([NaN, Infinity])('uses reference bounds before finite metadata (%s)', (duration) => {
    expect(clampReferenceSeek(125000, 120000, duration)).toBe(120000);
  });
  it.each([NaN, Infinity, -Infinity])('handles invalid player positions (%s)', (time) => {
    expect(clampReferenceSeek(time, 120000, 435)).toBe(0);
  });
  it('handles unavailable or empty reference duration', () => {
    expect(clampReferenceSeek(5000, NaN, 435)).toBe(0);
    expect(clampReferenceSeek(5000, 0, 435)).toBe(0);
  });
});
