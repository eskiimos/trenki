/** Experimental 2D colour tracker. All observations come from the current frame. */
export const EQUIPMENT_TARGETS = ['ball', 'stickTop', 'stickTip'] as const;
export type EquipmentTargetId = typeof EQUIPMENT_TARGETS[number];

export interface EquipmentColorSettings {
  /** Hue in degrees; saturation/value and component area are fractions, not percentages. */
  hue: number;
  tolerance: number;
  minSaturation: number;
  minValue: number;
  minAreaRatio: number;
  maxAreaRatio: number;
}

export interface EquipmentSettings {
  targets: Record<EquipmentTargetId, EquipmentColorSettings>;
}

export const DEFAULT_EQUIPMENT_SETTINGS: EquipmentSettings = {
  targets: {
    ball: { hue: 30, tolerance: 18, minSaturation: 0.55, minValue: 0.35, minAreaRatio: 0.00012, maxAreaRatio: 0.04 },
    stickTop: { hue: 180, tolerance: 20, minSaturation: 0.55, minValue: 0.35, minAreaRatio: 0.00012, maxAreaRatio: 0.03 },
    stickTip: { hue: 300, tolerance: 20, minSaturation: 0.55, minValue: 0.35, minAreaRatio: 0.00012, maxAreaRatio: 0.03 },
  },
};

export interface EquipmentImage {
  width: number;
  height: number;
  data: Uint8Array | Uint8ClampedArray;
}

export interface EquipmentPoint { x: number; y: number }

export interface EquipmentObservation extends EquipmentPoint {
  /** Radius relative to the smaller frame dimension. Bounding box uses frame-relative coordinates. */
  radius: number;
  bbox: { x: number; y: number; width: number; height: number };
  areaRatio: number;
}

export interface EquipmentTargetDetection {
  status: 'observed' | 'lost' | 'ambiguous';
  observation: EquipmentObservation | null;
  /** Heuristic colour/shape quality, not a calibrated probability. Zero when unobserved. */
  confidence: number;
  candidates: number;
}

export interface EquipmentDetection {
  timestampMs: number;
  targets: Record<EquipmentTargetId, EquipmentTargetDetection>;
  stick: { top: EquipmentPoint; tip: EquipmentPoint } | null;
}

export function rgbToHsv(r: number, g: number, b: number): { hue: number; saturation: number; value: number } {
  if (![r, g, b].every(value => Number.isFinite(value) && value >= 0 && value <= 255)) {
    throw new RangeError('RGB должен содержать числа от 0 до 255');
  }
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let hue = 0;
  if (delta > 0) {
    if (max === r) hue = 60 * ((g - b) / delta);
    else if (max === g) hue = 60 * (2 + (b - r) / delta);
    else hue = 60 * (4 + (r - g) / delta);
    if (hue < 0) hue += 360;
  }
  return { hue, saturation: max === 0 ? 0 : delta / max, value: max / 255 };
}

function hueDistance(a: number, b: number): number {
  const diff = Math.abs(a - b);
  return Math.min(diff, 360 - diff);
}

export function validateEquipmentSettings(settings: unknown): string | null {
  if (!settings || typeof settings !== 'object' || !('targets' in settings)) return 'Не заданы цвета объектов';
  const targets = (settings as EquipmentSettings).targets;
  if (!targets || typeof targets !== 'object') return 'Не заданы цвета объектов';
  for (const id of EQUIPMENT_TARGETS) {
    const target = targets[id];
    if (!target || typeof target !== 'object') return 'Нужны отдельные цвета мяча и двух меток';
    if (!Number.isFinite(target.hue) || target.hue < 0 || target.hue >= 360) return 'Оттенок должен быть от 0 до 359°';
    if (!Number.isFinite(target.tolerance) || target.tolerance < 1 || target.tolerance > 60) return 'Допуск оттенка должен быть от 1 до 60°';
    if (!Number.isFinite(target.minSaturation) || target.minSaturation < 0.1 || target.minSaturation > 1) return 'Насыщенность должна быть от 0,1 до 1';
    if (!Number.isFinite(target.minValue) || target.minValue < 0.05 || target.minValue > 1) return 'Яркость должна быть от 0,05 до 1';
    if (!Number.isFinite(target.minAreaRatio) || !Number.isFinite(target.maxAreaRatio)
      || target.minAreaRatio < 0 || target.maxAreaRatio <= target.minAreaRatio || target.maxAreaRatio > 0.25) {
      return 'Площадь объекта должна быть от 0 до 25% кадра, минимум меньше максимума';
    }
  }
  for (let i = 0; i < EQUIPMENT_TARGETS.length; i++) {
    for (let j = i + 1; j < EQUIPMENT_TARGETS.length; j++) {
      const a = targets[EQUIPMENT_TARGETS[i]];
      const b = targets[EQUIPMENT_TARGETS[j]];
      if (hueDistance(a.hue, b.hue) <= a.tolerance + b.tolerance) {
        return 'Цвета мяча и меток должны различаться: диапазоны оттенков пересекаются';
      }
    }
  }
  return null;
}

interface Candidate { observation: EquipmentObservation; confidence: number }
interface Track {
  confirmed: EquipmentObservation | null;
  confirmedAt: number;
  pending: EquipmentObservation | null;
  pendingAt: number;
}

const MAX_FRAME_PIXELS = 640 * 480;
const MAX_CANDIDATES = 32;
const MAX_FRAME_GAP_MS = 1000;
const IDENTITY_MEMORY_MS = 400;

function newTrack(): Track { return { confirmed: null, confirmedAt: 0, pending: null, pendingAt: 0 }; }
function distance(a: EquipmentPoint, b: EquipmentPoint): number { return Math.hypot(a.x - b.x, a.y - b.y); }

export class EquipmentTracker {
  private mask = new Uint8Array(0);
  private queue = new Int32Array(0);
  private tracks: Record<EquipmentTargetId, Track> = { ball: newTrack(), stickTop: newTrack(), stickTip: newTrack() };
  private settingsKey = '';
  private previousTimestamp: number | null = null;
  private frameSize = '';

  reset(): void {
    this.tracks = { ball: newTrack(), stickTop: newTrack(), stickTip: newTrack() };
    this.settingsKey = '';
    this.previousTimestamp = null;
    this.frameSize = '';
  }

  detect(image: EquipmentImage, timestampMs: number, settings: EquipmentSettings = DEFAULT_EQUIPMENT_SETTINGS): EquipmentDetection {
    const error = validateEquipmentSettings(settings);
    if (error) throw new Error(error);
    const { width, height, data } = image;
    const pixels = width * height;
    if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0
      || pixels > MAX_FRAME_PIXELS || !(data instanceof Uint8Array || data instanceof Uint8ClampedArray)
      || data.length !== pixels * 4) throw new Error('Нужен RGBA-кадр размером не более 640×480 пикселей');
    if (!Number.isFinite(timestampMs) || timestampMs < 0) throw new Error('Некорректное время кадра');

    const settingsKey = JSON.stringify(EQUIPMENT_TARGETS.map(id => {
      const color = settings.targets[id];
      return [color.hue, color.tolerance, color.minSaturation, color.minValue, color.minAreaRatio, color.maxAreaRatio];
    }));
    const frameSize = `${width}:${height}`;
    if (settingsKey !== this.settingsKey || frameSize !== this.frameSize
      || (this.previousTimestamp !== null && (timestampMs <= this.previousTimestamp || timestampMs - this.previousTimestamp > MAX_FRAME_GAP_MS))) {
      this.reset();
    }
    this.settingsKey = settingsKey;
    this.frameSize = frameSize;
    this.previousTimestamp = timestampMs;

    if (this.mask.length !== pixels) {
      this.mask = new Uint8Array(pixels);
      this.queue = new Int32Array(pixels);
    } else this.mask.fill(0);
    const colors = EQUIPMENT_TARGETS.map(id => settings.targets[id]);
    const minValue = Math.min(...colors.map(color => color.minValue));
    const minSaturation = Math.min(...colors.map(color => color.minSaturation));
    for (let pixel = 0; pixel < pixels; pixel++) {
      const offset = pixel * 4;
      if (data[offset + 3] < 128) continue;
      const r = data[offset]; const g = data[offset + 1]; const b = data[offset + 2];
      const max = Math.max(r, g, b); const min = Math.min(r, g, b);
      const delta = max - min;
      const value = max / 255;
      const saturation = max === 0 ? 0 : delta / max;
      if (value < minValue || saturation < minSaturation || delta === 0) continue;
      let hue: number;
      if (max === r) hue = 60 * ((g - b) / delta);
      else if (max === g) hue = 60 * (2 + (b - r) / delta);
      else hue = 60 * (4 + (r - g) / delta);
      if (hue < 0) hue += 360;
      for (let target = 0; target < colors.length; target++) {
        const color = colors[target];
        if (value >= color.minValue && saturation >= color.minSaturation && hueDistance(hue, color.hue) <= color.tolerance) {
          this.mask[pixel] = target + 1;
          break;
        }
      }
    }

    const candidates: Candidate[][] = [[], [], []];
    const candidateCounts = [0, 0, 0];
    // A single fixed queue visits each pixel at most once. No per-pixel objects/recursion.
    for (let seed = 0; seed < pixels; seed++) {
      const label = this.mask[seed];
      if (label === 0) continue;
      const target = label - 1;
      this.mask[seed] = 0;
      let head = 0; let tail = 1;
      this.queue[0] = seed;
      let sumX = 0; let sumY = 0; let minX = width; let maxX = 0; let minY = height; let maxY = 0;
      while (head < tail) {
        const index = this.queue[head++];
        const y = Math.floor(index / width); const x = index - y * width;
        sumX += x + 0.5; sumY += y + 0.5;
        minX = Math.min(minX, x); maxX = Math.max(maxX, x);
        minY = Math.min(minY, y); maxY = Math.max(maxY, y);
        for (let ny = Math.max(0, y - 1); ny <= Math.min(height - 1, y + 1); ny++) {
          for (let nx = Math.max(0, x - 1); nx <= Math.min(width - 1, x + 1); nx++) {
            const next = ny * width + nx;
            if (this.mask[next] === label) {
              this.mask[next] = 0;
              this.queue[tail++] = next;
            }
          }
        }
      }
      const color = colors[target];
      if (tail < Math.max(4, Math.ceil(color.minAreaRatio * pixels)) || tail > color.maxAreaRatio * pixels) continue;
      const boxWidth = maxX - minX + 1; const boxHeight = maxY - minY + 1;
      const fill = tail / (boxWidth * boxHeight);
      // A thin streak of similarly coloured background is not a useful point marker.
      if (fill < 0.25 || Math.max(boxWidth, boxHeight) / Math.min(boxWidth, boxHeight) > 5) continue;
      candidateCounts[target]++;
      if (candidates[target].length < MAX_CANDIDATES) candidates[target].push({
        observation: {
          x: sumX / tail / width, y: sumY / tail / height,
          radius: Math.sqrt(tail / Math.PI) / Math.min(width, height),
          bbox: { x: minX / width, y: minY / height, width: boxWidth / width, height: boxHeight / height },
          areaRatio: tail / pixels,
        },
        confidence: Math.min(1, 0.5 + fill * 0.5),
      });
    }

    const targets = {} as Record<EquipmentTargetId, EquipmentTargetDetection>;
    for (let index = 0; index < EQUIPMENT_TARGETS.length; index++) {
      const id = EQUIPMENT_TARGETS[index];
      targets[id] = this.associate(this.tracks[id], candidates[index], candidateCounts[index], timestampMs);
    }
    const top = targets.stickTop.observation; const tip = targets.stickTip.observation;
    return { timestampMs, targets, stick: top && tip ? { top: { x: top.x, y: top.y }, tip: { x: tip.x, y: tip.y } } : null };
  }

  private associate(track: Track, candidates: Candidate[], count: number, timestamp: number): EquipmentTargetDetection {
    const missing = (status: 'lost' | 'ambiguous'): EquipmentTargetDetection => ({ status, observation: null, confidence: 0, candidates: count });
    const observed = (candidate: Candidate): EquipmentTargetDetection => {
      // Copy the internal point so callers cannot mutate the next frame's association.
      track.confirmed = { ...candidate.observation, bbox: { ...candidate.observation.bbox } };
      track.confirmedAt = timestamp;
      track.pending = null;
      return { status: 'observed', observation: candidate.observation, confidence: candidate.confidence, candidates: count };
    };
    if (track.confirmed && timestamp - track.confirmedAt > IDENTITY_MEMORY_MS) track.confirmed = null;
    if (count === 0 || count > MAX_CANDIDATES) {
      track.pending = null;
      return missing(count === 0 ? 'lost' : 'ambiguous');
    }
    if (!track.confirmed) {
      track.pending = null;
      return count === 1 ? observed(candidates[0]) : missing('ambiguous');
    }
    const maxDistance = Math.min(0.35, 0.10 + (timestamp - track.confirmedAt) * 0.0015);
    const nearby = candidates.map(candidate => ({ candidate, distance: distance(candidate.observation, track.confirmed!) }))
      .filter(item => item.distance <= maxDistance).sort((a, b) => a.distance - b.distance);
    if (nearby.length === 1) return observed(nearby[0].candidate);
    if (nearby.length > 1) {
      track.pending = null;
      // Only a clearly isolated nearest candidate can retain an existing identity.
      if (nearby[1].distance - nearby[0].distance >= 0.08 && nearby[0].distance < nearby[1].distance * 0.5) return observed(nearby[0].candidate);
      return missing('ambiguous');
    }
    if (count === 1) {
      const candidate = candidates[0];
      // A jump needs a second nearby observation before reacquisition; one bright flash is insufficient.
      if (track.pending && timestamp - track.pendingAt <= 250 && distance(track.pending, candidate.observation) <= 0.06) return observed(candidate);
      track.pending = { ...candidate.observation, bbox: { ...candidate.observation.bbox } };
      track.pendingAt = timestamp;
    } else track.pending = null;
    return missing('ambiguous');
  }
}
