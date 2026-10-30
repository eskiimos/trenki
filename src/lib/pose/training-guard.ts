import { assessmentAngles } from './assessment';
import { ASSESSMENT_ANGLES, OPPOSITE, type AssessmentAngleKey, type AssessmentSettings } from './assessment-settings';
import { hasPose } from './reference';

/** Experimental thresholds: pause only on clearly moving references, never on static holds. */
export const TRAINING_GUARD = {
  missingMs: 1000,
  stationaryMs: 5000,
  windowMs: 1200,
  minimumWindowMs: 600,
  referenceExcursionDeg: 8,
  cameraExcursionDeg: 3,
  maximumGapMs: 1200,
  maximumReferenceDistanceMs: 200,
} as const;

type Angles = Record<AssessmentAngleKey, number | null>;
type MotionSample = { time: number; reference: Angles; camera: Angles };
export interface TrainingGuardState {
  signature: string | null;
  previous: { timestampMs: number; mediaMs: number } | null;
  samples: MotionSample[];
  missingSinceMs: number | null;
  stationarySinceMs: number | null;
}

export function createTrainingGuardState(): TrainingGuardState {
  return { signature: null, previous: null, samples: [], missingSinceMs: null, stationarySinceMs: null };
}

export function resetTrainingGuard(state: TrainingGuardState): void {
  Object.assign(state, createTrainingGuardState());
}

export interface TrainingGuardInput {
  cameraFrame: number[];
  referenceFrame?: number[];
  settings: AssessmentSettings;
  timestampMs: number;
  mediaMs: number;
  playbackRate?: number;
  sideMode?: 'same' | 'opposite';
  /** Running + tracked exercise, with no buffering, seek, hidden tab or theory. */
  enabled: boolean;
  /** Include segment identity and settings so timers cannot cross exercise boundaries. */
  signature: string;
}

export interface TrainingGuardResult {
  reason: 'missing' | 'stationary' | null;
  missingMs: number;
  stationaryMs: number;
  referenceMoving: boolean;
}

const noPause = (): TrainingGuardResult => ({ reason: null, missingMs: 0, stationaryMs: 0, referenceMoving: false });

/** Updates bounded state using capture wall time; callers pause playback on a returned reason. */
export function evaluateTrainingGuard(state: TrainingGuardState, input: TrainingGuardInput): TrainingGuardResult {
  const { timestampMs: now, mediaMs, settings } = input;
  const rate = input.playbackRate ?? 1;
  const enabledAngles = ASSESSMENT_ANGLES.filter(key => settings.weights[key] > 0);
  if (!input.enabled || settings.enabled === false || !enabledAngles.length
    || !Number.isFinite(now) || now < 0 || !Number.isFinite(mediaMs) || mediaMs < 0 || !Number.isFinite(rate) || rate <= 0) {
    resetTrainingGuard(state);
    return noPause();
  }
  if (state.signature !== input.signature) resetTrainingGuard(state);
  const previous = state.previous;
  if (previous) {
    const elapsed = now - previous.timestampMs;
    const videoElapsed = mediaMs - previous.mediaMs;
    if (elapsed <= 0 || elapsed > TRAINING_GUARD.maximumGapMs || videoElapsed <= 0
      || Math.abs(videoElapsed - elapsed * rate) > 350) resetTrainingGuard(state);
  }
  state.signature = input.signature;
  state.previous = { timestampMs: now, mediaMs };
  const opposite = input.sideMode === 'opposite';
  const camera = assessmentAngles(input.cameraFrame);
  const cameraKey = (key: AssessmentAngleKey) => opposite ? OPPOSITE[key] : key;
  const enabledWeight = enabledAngles.reduce((sum, key) => sum + settings.weights[key], 0);
  const visibleWeight = enabledAngles.reduce((sum, key) => camera[cameraKey(key)] === null ? sum : sum + settings.weights[key], 0);
  const usableCamera = hasPose(input.cameraFrame)
    && settings.requiredAngles.every(key => settings.weights[key] <= 0 || camera[cameraKey(key)] !== null)
    && visibleWeight / enabledWeight >= 0.75;
  if (!usableCamera) {
    state.samples = [];
    state.stationarySinceMs = null;
    state.missingSinceMs ??= now;
    const missingMs = now - state.missingSinceMs;
    return { ...noPause(), missingMs, reason: missingMs >= TRAINING_GUARD.missingMs ? 'missing' : null };
  }
  state.missingSinceMs = null;
  const rawReference = input.referenceFrame;
  const reference = rawReference && hasPose(rawReference) && Math.abs(rawReference[0] - mediaMs) <= TRAINING_GUARD.maximumReferenceDistanceMs
    ? assessmentAngles(rawReference) : null;
  const comparable = reference ? enabledAngles.filter(key => reference[key] !== null && camera[cameraKey(key)] !== null) : [];
  const comparableWeight = comparable.reduce((sum, key) => sum + settings.weights[key], 0);
  if (!reference || comparableWeight / enabledWeight < 0.75 || !settings.requiredAngles.every(key => settings.weights[key] <= 0 || reference[key] !== null)) {
    state.samples = [];
    state.stationarySinceMs = null;
    return noPause();
  }
  const alignedCamera = Object.fromEntries(ASSESSMENT_ANGLES.map(key => [key, camera[cameraKey(key)]])) as Angles;
  state.samples.push({ time: now, camera: alignedCamera, reference });
  state.samples = state.samples.filter(sample => now - sample.time <= TRAINING_GUARD.windowMs).slice(-60);
  if (state.samples.length < 3 || now - state.samples[0].time < TRAINING_GUARD.minimumWindowMs) {
    state.stationarySinceMs = null;
    return noPause();
  }
  // Range rather than accumulated frame-to-frame noise keeps noisy static holds static.
  const excursion = (kind: 'camera' | 'reference') => {
    let sum = 0, weight = 0;
    for (const key of comparable) {
      const values = state.samples.map(sample => sample[kind][key]).filter((value): value is number => value !== null);
      if (values.length !== state.samples.length) continue;
      sum += (Math.max(...values) - Math.min(...values)) * settings.weights[key];
      weight += settings.weights[key];
    }
    return weight >= enabledWeight * 0.75 ? sum / weight : null;
  };
  const teacherMotion = excursion('reference'), learnerMotion = excursion('camera');
  const referenceMoving = teacherMotion !== null && teacherMotion >= TRAINING_GUARD.referenceExcursionDeg;
  if (!referenceMoving || learnerMotion === null || learnerMotion > TRAINING_GUARD.cameraExcursionDeg) {
    state.stationarySinceMs = null;
    return { ...noPause(), referenceMoving };
  }
  state.stationarySinceMs ??= now;
  const stationaryMs = now - state.stationarySinceMs;
  return { reason: stationaryMs >= TRAINING_GUARD.stationaryMs ? 'stationary' : null, missingMs: 0, stationaryMs, referenceMoving };
}
