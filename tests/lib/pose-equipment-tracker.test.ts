import { describe, expect, it } from 'vitest';
import {
  DEFAULT_EQUIPMENT_SETTINGS,
  EquipmentTracker,
  rgbToHsv,
  validateEquipmentSettings,
  type EquipmentImage,
  type EquipmentSettings,
} from '../../src/lib/pose/equipment-tracker';

const ORANGE = [255, 128, 0] as const;
const CYAN = [0, 255, 255] as const;
const MAGENTA = [255, 0, 255] as const;
type RGB = readonly [number, number, number];

function frame(width = 100, height = 100): EquipmentImage {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 3; i < data.length; i += 4) data[i] = 255;
  return { width, height, data };
}

function rect(image: EquipmentImage, x: number, y: number, width: number, height: number, rgb: RGB): EquipmentImage {
  for (let dy = y; dy < y + height; dy++) {
    for (let dx = x; dx < x + width; dx++) image.data.set([...rgb, 255], (dy * image.width + dx) * 4);
  }
  return image;
}

function settings(): EquipmentSettings { return structuredClone(DEFAULT_EQUIPMENT_SETTINGS); }
function ball(x: number, y = 40): EquipmentImage { return rect(frame(), x, y, 5, 5, ORANGE); }

describe('equipment colour configuration', () => {
  it('converts primary colours and achromatic pixels to HSV', () => {
    expect(rgbToHsv(255, 128, 0)).toEqual({ hue: 128 / 255 * 60, saturation: 1, value: 1 });
    expect(rgbToHsv(...CYAN)).toEqual({ hue: 180, saturation: 1, value: 1 });
    expect(rgbToHsv(...MAGENTA)).toEqual({ hue: 300, saturation: 1, value: 1 });
    expect(rgbToHsv(0, 0, 0)).toEqual({ hue: 0, saturation: 0, value: 0 });
    expect(rgbToHsv(128, 128, 128)).toEqual({ hue: 0, saturation: 0, value: 128 / 255 });
    expect(rgbToHsv(255, 0, 128).hue).toBeCloseTo(360 - 128 / 255 * 60);
    expect(() => rgbToHsv(Number.NaN, 1, 2)).toThrow();
    expect(() => rgbToHsv(256, 1, 2)).toThrow();
  });

  it('accepts distinct ranges and rejects intersecting ranges including across 0 degrees', () => {
    expect(validateEquipmentSettings(settings())).toBeNull();
    const config = settings();
    config.targets.ball.hue = 359;
    config.targets.stickTip.hue = 5;
    expect(validateEquipmentSettings(config)).toMatch(/пересекаются/);
    config.targets.stickTip.hue = 319;
    config.targets.ball.tolerance = 20;
    expect(validateEquipmentSettings(config)).toMatch(/пересекаются/); // Inclusive endpoints touch at 339°.
    config.targets.stickTip.hue = 318;
    expect(validateEquipmentSettings(config)).toBeNull();
  });

  it('rejects incomplete, nonfinite, and unsafe settings', () => {
    for (const invalid of [null, {}, { targets: {} }]) expect(validateEquipmentSettings(invalid)).not.toBeNull();
    for (const [key, value] of [
      ['hue', -1], ['hue', 360], ['hue', Number.NaN], ['tolerance', 0], ['tolerance', 61],
      ['minSaturation', 0], ['minSaturation', 1.1], ['minValue', -1], ['minValue', Number.POSITIVE_INFINITY],
      ['minAreaRatio', -1], ['maxAreaRatio', 0], ['maxAreaRatio', 0.5],
    ] as const) {
      const config = settings();
      config.targets.ball[key] = value;
      expect(validateEquipmentSettings(config), `${key}=${value}`).not.toBeNull();
    }
  });
});

describe('EquipmentTracker current-frame observations', () => {
  it('detects three independent colours and joins only the current two stick endpoints', () => {
    const image = rect(rect(rect(frame(), 10, 20, 6, 6, ORANGE), 50, 10, 4, 6, CYAN), 70, 70, 5, 5, MAGENTA);
    const result = new EquipmentTracker().detect(image, 0);
    expect(result.targets.ball.status).toBe('observed');
    expect(result.targets.ball.observation).toMatchObject({ x: 0.13, y: 0.23, areaRatio: 0.0036 });
    expect(result.targets.ball.observation?.bbox).toEqual({ x: 0.1, y: 0.2, width: 0.06, height: 0.06 });
    expect(result.targets.stickTop.status).toBe('observed');
    expect(result.targets.stickTip.status).toBe('observed');
    expect(result.stick).toEqual({ top: { x: 0.52, y: 0.13 }, tip: { x: 0.725, y: 0.725 } });
    expect(result.targets.ball.confidence).toBeGreaterThan(0);
  });

  it('matches hue across red wraparound without confusing the other target identities', () => {
    const config = settings();
    config.targets.ball.hue = 359;
    config.targets.ball.tolerance = 15;
    const image = rect(rect(rect(frame(), 10, 10, 5, 5, [255, 20, 0]), 30, 30, 5, 5, [255, 0, 20]), 60, 60, 5, 5, MAGENTA);
    const result = new EquipmentTracker().detect(image, 0, config);
    expect(result.targets.ball.status).toBe('ambiguous');
    expect(result.targets.ball.candidates).toBe(2);
    expect(result.targets.stickTip.status).toBe('observed');
    expect(result.targets.stickTop.status).toBe('lost');
  });

  it('rejects dark, grey, transparent pixels, tiny specks and a huge coloured backdrop', () => {
    const image = rect(rect(rect(rect(rect(frame(), 0, 0, 50, 50, ORANGE), 60, 0, 5, 5, [60, 30, 0]), 60, 20, 5, 5, [180, 160, 140]), 60, 40, 1, 1, ORANGE), 60, 60, 5, 5, ORANGE);
    for (let y = 60; y < 65; y++) for (let x = 60; x < 65; x++) image.data[(y * image.width + x) * 4 + 3] = 0;
    const result = new EquipmentTracker().detect(image, 0);
    expect(result.targets.ball).toEqual({ status: 'lost', observation: null, confidence: 0, candidates: 0 });
  });

  it('rejects a long line that cannot be localized as a compact ball/marker', () => {
    const image = rect(frame(), 10, 30, 50, 2, ORANGE);
    expect(new EquipmentTracker().detect(image, 0).targets.ball.status).toBe('lost');
  });

  it('respects configured component area limits', () => {
    const config = settings();
    config.targets.ball.minAreaRatio = 0.004;
    expect(new EquipmentTracker().detect(ball(10), 0, config).targets.ball.status).toBe('lost');
    config.targets.ball.minAreaRatio = 0;
    config.targets.ball.maxAreaRatio = 0.002;
    expect(new EquipmentTracker().detect(ball(10), 0, config).targets.ball.status).toBe('lost');
  });

  it('does not join components through opposite frame edges', () => {
    const image = rect(rect(frame(), 98, 20, 2, 3, ORANGE), 0, 21, 2, 3, ORANGE);
    const result = new EquipmentTracker().detect(image, 0);
    expect(result.targets.ball.status).toBe('ambiguous');
    expect(result.targets.ball.candidates).toBe(2);
  });

  it('removes a missing endpoint and the stick immediately, without returning frozen coordinates', () => {
    const tracker = new EquipmentTracker();
    const both = rect(rect(frame(), 10, 10, 5, 5, CYAN), 80, 80, 5, 5, MAGENTA);
    expect(tracker.detect(both, 0).stick).not.toBeNull();
    const result = tracker.detect(rect(frame(), 80, 80, 5, 5, MAGENTA), 66);
    expect(result.targets.stickTop).toEqual({ status: 'lost', observation: null, confidence: 0, candidates: 0 });
    expect(result.targets.stickTip.status).toBe('observed');
    expect(result.stick).toBeNull();
  });

  it('returns scale-independent centers, bounds and radii', () => {
    const small = rect(frame(100, 80), 18, 38, 4, 4, ORANGE);
    const large = rect(frame(200, 160), 36, 76, 8, 8, ORANGE);
    const tracker = new EquipmentTracker();
    expect(tracker.detect(small, 0).targets.ball.observation).toEqual(tracker.detect(large, 66).targets.ball.observation);
  });

  it('handles a 320×240 frame and a typed byte view', () => {
    const image = rect(frame(320, 240), 100, 100, 8, 8, ORANGE);
    image.data = new Uint8Array(image.data.buffer);
    const observation = new EquipmentTracker().detect(image, 0).targets.ball.observation;
    expect(observation?.x).toBeCloseTo(104 / 320);
    expect(observation?.y).toBeCloseTo(104 / 240);
  });

  it('bounds candidate memory and refuses an overcrowded scene rather than picking the first blob', () => {
    const image = frame();
    for (let y = 1; y < 95; y += 10) for (let x = 1; x < 95; x += 10) rect(image, x, y, 2, 2, ORANGE);
    const result = new EquipmentTracker().detect(image, 0);
    expect(result.targets.ball.status).toBe('ambiguous');
    expect(result.targets.ball.candidates).toBe(100);
    expect(result.targets.ball.observation).toBeNull();
  });

  it('rejects invalid frame/configuration inputs before allocating large buffers', () => {
    const tracker = new EquipmentTracker();
    expect(() => tracker.detect({ ...frame(), width: -1 }, 0)).toThrow(/RGBA/);
    expect(() => tracker.detect({ width: 100_000, height: 100_000, data: new Uint8Array() }, 0)).toThrow(/RGBA/);
    expect(() => tracker.detect({ width: 10, height: 10, data: new Uint8Array(3) }, 0)).toThrow(/RGBA/);
    expect(() => tracker.detect(frame(), Number.NaN)).toThrow(/время/);
    const config = settings(); config.targets.ball.hue = 180;
    expect(() => tracker.detect(frame(), 0, config)).toThrow(/пересекаются/);
  });
});

describe('EquipmentTracker association and reset', () => {
  it('reports ambiguity when initial same-colour candidates have no established identity', () => {
    const result = new EquipmentTracker().detect(rect(ball(10), 75, 40, 5, 5, ORANGE), 0);
    expect(result.targets.ball.status).toBe('ambiguous');
    expect(result.targets.ball.observation).toBeNull();
    expect(result.targets.ball.confidence).toBe(0);
  });

  it('retains a nearby identity in the presence of a distant same-colour distractor', () => {
    const tracker = new EquipmentTracker();
    tracker.detect(ball(10), 0);
    const result = tracker.detect(rect(ball(13), 75, 40, 8, 8, ORANGE), 66);
    expect(result.targets.ball.status).toBe('observed');
    expect(result.targets.ball.candidates).toBe(2);
    expect(result.targets.ball.observation?.x).toBe(0.155);
  });

  it('does not silently choose between two similarly plausible nearby objects', () => {
    const tracker = new EquipmentTracker();
    tracker.detect(ball(48), 0);
    const result = tracker.detect(rect(ball(40), 56, 40, 5, 5, ORANGE), 66);
    expect(result.targets.ball.status).toBe('ambiguous');
    expect(result.targets.ball.observation).toBeNull();
  });

  it('needs a second stable observation after an implausible jump', () => {
    const tracker = new EquipmentTracker();
    tracker.detect(ball(10), 0);
    expect(tracker.detect(ball(80), 66).targets.ball.status).toBe('ambiguous');
    const confirmed = tracker.detect(ball(81), 132).targets.ball;
    expect(confirmed.status).toBe('observed');
    expect(confirmed.observation?.x).toBe(0.835);
  });

  it('does not confirm a far one-frame flash after an intervening blank frame', () => {
    const tracker = new EquipmentTracker();
    tracker.detect(ball(10), 0);
    expect(tracker.detect(ball(80), 66).targets.ball.status).toBe('ambiguous');
    expect(tracker.detect(frame(), 132).targets.ball.status).toBe('lost');
    expect(tracker.detect(ball(80), 198).targets.ball.status).toBe('ambiguous');
  });

  it('can reacquire a briefly occluded object near the last position', () => {
    const tracker = new EquipmentTracker();
    tracker.detect(ball(10), 0);
    expect(tracker.detect(frame(), 66).targets.ball.observation).toBeNull();
    expect(tracker.detect(rect(ball(13), 75, 40, 5, 5, ORANGE), 132).targets.ball.observation?.x).toBe(0.155);
  });

  it('expires identity after sustained loss instead of using an old position to resolve ambiguity', () => {
    const tracker = new EquipmentTracker();
    tracker.detect(ball(10), 0);
    tracker.detect(frame(), 66);
    const result = tracker.detect(rect(ball(13), 75, 40, 5, 5, ORANGE), 500);
    expect(result.targets.ball.status).toBe('ambiguous');
  });

  it('resets continuity on explicit reset, changed settings, time gaps and backwards timestamps', () => {
    const tracker = new EquipmentTracker();
    tracker.detect(ball(10), 0);
    tracker.reset();
    expect(tracker.detect(ball(80), 66).targets.ball.status).toBe('observed');
    const config = settings(); config.targets.ball.tolerance = 17;
    expect(tracker.detect(ball(10), 132, config).targets.ball.status).toBe('observed');
    expect(tracker.detect(ball(80), 1500, config).targets.ball.status).toBe('observed');
    expect(tracker.detect(ball(10), 50, config).targets.ball.status).toBe('observed');
  });

  it('detects mutations to a settings object rather than comparing only object identity', () => {
    const tracker = new EquipmentTracker();
    const config = settings();
    tracker.detect(ball(10), 0, config);
    config.targets.ball.minValue = 0.4;
    expect(tracker.detect(ball(80), 66, config).targets.ball.status).toBe('observed');
  });

  it('keeps continuity when an equivalent settings object has a different property order', () => {
    const tracker = new EquipmentTracker();
    const config = settings();
    tracker.detect(ball(10), 0, config);
    config.targets.ball = {
      maxAreaRatio: config.targets.ball.maxAreaRatio,
      minAreaRatio: config.targets.ball.minAreaRatio,
      minValue: config.targets.ball.minValue,
      minSaturation: config.targets.ball.minSaturation,
      tolerance: config.targets.ball.tolerance,
      hue: config.targets.ball.hue,
    };
    expect(tracker.detect(ball(80), 66, config).targets.ball.status).toBe('ambiguous');
  });

  it('cannot have internal identity positions changed through an old result', () => {
    const tracker = new EquipmentTracker();
    const result = tracker.detect(ball(10), 0);
    result.targets.ball.observation!.x = 0.8;
    expect(tracker.detect(ball(80), 66).targets.ball.status).toBe('ambiguous');
  });
});
