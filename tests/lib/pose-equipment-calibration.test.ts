import { describe, expect, it } from 'vitest';
import { videoPointFromClient } from '../../src/lib/pose/equipment-calibration';

describe('equipment camera colour calibration coordinates', () => {
  const box = { left: 20, top: 50, width: 320, height: 240 };

  it('uses CSS coordinates independently of source resolution or canvas pixel ratio', () => {
    expect(videoPointFromClient(100, 230, box, 640, 480, false)).toEqual({ x: 0.25, y: 0.75 });
    expect(videoPointFromClient(100, 230, box, 1280, 960, false)).toEqual({ x: 0.25, y: 0.75 });
    expect(videoPointFromClient(100, 230, box, 1920, 1440, false)).toEqual({ x: 0.25, y: 0.75 });
  });

  it('inverts only the horizontal coordinate of asymmetric taps for a mirrored preview', () => {
    expect(videoPointFromClient(100, 230, box, 640, 480, true)).toEqual({ x: 0.75, y: 0.75 });
    expect(videoPointFromClient(260, 110, box, 640, 480, true)).toEqual({ x: 0.25, y: 0.25 });
  });

  it('accounts for horizontal letterboxing of a portrait camera in a landscape box', () => {
    // A 240×320 portrait frame occupies x=90…270, y=50…290.
    expect(videoPointFromClient(135, 110, box, 240, 320, false)).toEqual({ x: 0.25, y: 0.25 });
    expect(videoPointFromClient(135, 110, box, 240, 320, true)).toEqual({ x: 0.75, y: 0.25 });
    expect(videoPointFromClient(89, 170, box, 240, 320, false)).toBeNull();
    expect(videoPointFromClient(271, 170, box, 240, 320, true)).toBeNull();
  });

  it('accounts for vertical letterboxing of a landscape camera in a portrait box', () => {
    const portraitBox = { left: 10, top: 30, width: 240, height: 320 };
    // A 320×240 landscape frame occupies x=10…250, y=100…280.
    expect(videoPointFromClient(70, 235, portraitBox, 320, 240, false)).toEqual({ x: 0.25, y: 0.75 });
    expect(videoPointFromClient(130, 99, portraitBox, 320, 240, false)).toBeNull();
    expect(videoPointFromClient(130, 281, portraitBox, 320, 240, true)).toBeNull();
  });

  it('keeps exact image edges usable and rejects taps outside the preview', () => {
    expect(videoPointFromClient(20, 50, box, 640, 480, false)).toEqual({ x: 0, y: 0 });
    expect(videoPointFromClient(340, 290, box, 640, 480, true)).toEqual({ x: 0, y: 1 });
    expect(videoPointFromClient(19, 50, box, 640, 480, false)).toBeNull();
    expect(videoPointFromClient(341, 290, box, 640, 480, false)).toBeNull();
    expect(videoPointFromClient(20, 49, box, 640, 480, false)).toBeNull();
    expect(videoPointFromClient(340, 291, box, 640, 480, false)).toBeNull();
  });

  it.each([0, -1, NaN, Infinity, -Infinity])('rejects invalid source dimensions %s', dimension => {
    expect(videoPointFromClient(100, 100, box, dimension, 480, false)).toBeNull();
    expect(videoPointFromClient(100, 100, box, 640, dimension, false)).toBeNull();
  });

  it.each([0, -1, NaN, Infinity])('rejects invalid preview dimensions %s', dimension => {
    expect(videoPointFromClient(100, 100, { ...box, width: dimension }, 640, 480, false)).toBeNull();
    expect(videoPointFromClient(100, 100, { ...box, height: dimension }, 640, 480, false)).toBeNull();
  });

  it.each([NaN, Infinity, -Infinity])('rejects nonfinite pointer or box offsets %s', value => {
    expect(videoPointFromClient(value, 100, box, 640, 480, false)).toBeNull();
    expect(videoPointFromClient(100, value, box, 640, 480, false)).toBeNull();
    expect(videoPointFromClient(100, 100, { ...box, left: value }, 640, 480, false)).toBeNull();
    expect(videoPointFromClient(100, 100, { ...box, top: value }, 640, 480, false)).toBeNull();
  });
});
