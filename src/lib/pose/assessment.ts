// Experimental live comparison of joint angles. Camera frames never leave the
// browser. This measures pose similarity, not exercise safety or correctness.
import {
  frameAngles,
  frameIndexAt,
  hasPose,
  jointAngle,
  point2d,
  point3d,
  validateReferenceDoc,
  type PoseReferenceDoc,
} from '@/lib/pose/reference';
import { parseSegments, type Segment } from '@/lib/pose/segments';

export type AssessmentSideMode = 'same' | 'opposite';
export type { AssessmentAngleKey } from './assessment-settings';
import { ASSESSMENT_ANGLES as ANGLES, REQUIRED_POINTS, OPPOSITE, assessmentPreset, type AssessmentAngleKey, type AssessmentSettings } from './assessment-settings';
export type AssessmentGroup = 'legs' | 'arms' | 'trunk';
export type AssessmentStatus =
  | 'scored'
  | 'no_segments'
  | 'inactive'
  | 'out_of_range'
  | 'reference_gap'
  | 'no_reference_pose'
  | 'no_camera_pose'
  | 'insufficient_visibility';

/** A fixed temporal comparison, with no search for a future matching pose. */
export const ASSESSMENT_MAX_FRAME_DISTANCE_MS = 150;
export const ASSESSMENT_MIN_ANGLES = 4;
export const ASSESSMENT_MIN_VISIBILITY = 0.6;
export const ASSESSMENT_MAX_SAMPLE_MS = 500;
export const ASSESSMENT_MIN_COVERAGE = 0.75;
export const ASSESSMENT_MIN_SCORED_MS = 3000;

export interface AssessmentClock { mediaMs: number; capturedAtMs: number }

/** Playing wall time, including slow inference but excluding jumps in the lesson clock. */
export function assessmentSampleDuration(previous: AssessmentClock | null, current: AssessmentClock, playbackRate: number): number {
  if (!previous || !Number.isFinite(playbackRate) || playbackRate <= 0) return 0;
  const elapsed = current.capturedAtMs - previous.capturedAtMs;
  const mediaElapsed = current.mediaMs - previous.mediaMs;
  if (!Number.isFinite(elapsed) || !Number.isFinite(mediaElapsed) || elapsed <= 0 || mediaElapsed <= 0) return 0;
  if (Math.abs(mediaElapsed - elapsed * playbackRate) > 200) return 0;
  return Math.min(elapsed, ASSESSMENT_MAX_SAMPLE_MS);
}

const GROUPS: Record<AssessmentGroup, { label: string; angles: AssessmentAngleKey[] }> = {
  legs: { label: 'Ноги и таз', angles: ['kneeL', 'kneeR', 'hipL', 'hipR'] },
  arms: { label: 'Руки и плечи', angles: ['elbowL', 'elbowR', 'shoulderL', 'shoulderR'] },
  trunk: { label: 'Корпус', angles: ['trunk'] },
};
type Angles = Record<AssessmentAngleKey, number | null>;
interface AssessmentReferenceFrame {
  timeMs: number;
  hasPose: boolean;
  angles: Angles;
}
export interface PreparedAssessmentReference {
  durationMs: number;
  segments: Segment[];
  /** Timestamp-only frames let the shared binary search avoid retaining raw poses. */
  times: number[][];
  frames: AssessmentReferenceFrame[];
}
export interface AssessmentAngleError {
  key: AssessmentAngleKey;
  cameraKey: AssessmentAngleKey;
  referenceDeg: number;
  cameraDeg: number;
  errorDeg: number;
  score: number;
  weight: number;
}
export interface AssessmentFeedback {
  group: AssessmentGroup;
  label: string;
  score: number;
  meanErrorDeg: number;
  comparedAngles: number;
}
export interface PoseAssessmentResult {
  status: AssessmentStatus;
  message: string;
  /** null means this moment cannot be evaluated, never a previous good score. */
  score: number | null;
  comparedAngles: number;
  /** Compared joint weight divided by usable reference joint weight. */
  coverageRatio: number;
  comparedWeight: number;
  expectedWeight: number;
  referenceTimeMs: number | null;
  feedback: AssessmentFeedback[];
  angleErrors: AssessmentAngleError[];
}

export function usableAssessmentPoint(frame: number[], id: number): boolean {
  const { x, y, v } = point2d(frame, id);
  return Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(v)
    && x >= 0 && x <= 1 && y >= 0 && y <= 1 && v >= ASSESSMENT_MIN_VISIBILITY;
}

export function assessmentAngles(frame: number[]): Angles {
  const angles: Angles = { ...frameAngles(frame), shoulderL: null, shoulderR: null };
  if (!hasPose(frame)) return angles;
  for (const key of ['shoulderL', 'shoulderR'] as const) {
    const [a, b, c] = REQUIRED_POINTS[key]!;
    const degrees = jointAngle(point3d(frame, a!), point3d(frame, b!), point3d(frame, c!));
    angles[key] = Number.isFinite(degrees) ? degrees : null;
  }
  for (const key of ANGLES) {
    if (!REQUIRED_POINTS[key].every((id) => usableAssessmentPoint(frame, id))) angles[key] = null;
  }
  return angles;
}

/** Compute reference angles once, rather than reprocessing all frames per camera tick. */
export function prepareAssessmentReference(doc: PoseReferenceDoc, segments: Segment[]): PreparedAssessmentReference {
  const error = validateReferenceDoc(doc);
  if (error) throw new Error(`Неверный эталон: ${error}`);
  const normalized = parseSegments(segments, doc.durationMs);
  if (!normalized) throw new Error('Неверная разметка рабочих отрезков');
  return {
    durationMs: doc.durationMs,
    segments: normalized,
    times: doc.frames.map((frame) => [frame[0]!]),
    frames: doc.frames.map((frame) => ({ timeMs: frame[0]!, hasPose: hasPose(frame), angles: assessmentAngles(frame) })),
  };
}

/** Configured tolerance is the noise floor; the next 60° reduce similarity to zero. */
function angleScore(errorDeg: number, toleranceDeg: number): number {
  return Math.max(0, Math.min(100, 100 * (1 - Math.max(0, errorDeg - toleranceDeg) / 60)));
}

function unavailable(status: Exclude<AssessmentStatus, 'scored'>, message: string): PoseAssessmentResult {
  return {
    status, message, score: null, comparedAngles: 0, coverageRatio: 0,
    comparedWeight: 0, expectedWeight: 0, referenceTimeMs: null, feedback: [], angleErrors: [],
  };
}

/** videoTimeMs is the synchronized lesson time, not the camera stream timestamp. */
export function evaluatePoseAssessment(
  reference: PreparedAssessmentReference,
  cameraFrame: number[],
  videoTimeMs: number,
  sideMode: AssessmentSideMode = 'opposite',
): PoseAssessmentResult {
  if (!reference.segments.length) return unavailable('no_segments', 'Нет рабочих отрезков. Сначала разметьте эталон.');
  if (!Number.isFinite(videoTimeMs) || videoTimeMs < 0 || videoTimeMs >= reference.durationMs) {
    return unavailable('out_of_range', 'Время вне длительности эталона.');
  }
  const segment = reference.segments.find((s) => videoTimeMs >= s.startMs && videoTimeMs < s.endMs);
  if (!segment) return unavailable('inactive', 'Объяснение или отдых — оценка приостановлена.');
  if (segment.assessment?.enabled === false) return unavailable('inactive', 'Биомеханика отключена для этого отрезка — оценка не учитывается.');
  const index = frameIndexAt(reference.times, videoTimeMs);
  const teacher = reference.frames[index];
  // A frame outside the current work interval must not leak across its boundary.
  if (!teacher || Math.abs(teacher.timeMs - videoTimeMs) > ASSESSMENT_MAX_FRAME_DISTANCE_MS
    || teacher.timeMs < segment.startMs || teacher.timeMs >= segment.endMs) {
    return unavailable('reference_gap', 'Для этого момента нет близкого кадра эталона.');
  }
  const settings = segment.assessment ?? assessmentPreset();
  const enabled = ANGLES.filter((key) => settings.weights[key] > 0);
  const minAngles = Math.min(ASSESSMENT_MIN_ANGLES, enabled.length);
  const totalWeight = enabled.reduce((sum, key) => sum + settings.weights[key], 0);
  const referenceAngles = enabled.filter((key) => teacher.angles[key] != null);
  const expectedWeight = referenceAngles.reduce((sum, key) => sum + settings.weights[key], 0);
  if (!teacher.hasPose || referenceAngles.length < minAngles
    || settings.requiredAngles.some((key) => teacher.angles[key] == null)
    || expectedWeight / totalWeight < ASSESSMENT_MIN_COVERAGE) {
    return { ...unavailable('no_reference_pose', 'На этом кадре эталона тренер виден недостаточно.'), referenceTimeMs: teacher.timeMs };
  }
  if (!hasPose(cameraFrame)) {
    return {
      ...unavailable('no_camera_pose', 'Камера не видит человека. Встаньте целиком в кадр.'),
      expectedWeight, referenceTimeMs: teacher.timeMs,
    };
  }
  const camera = assessmentAngles(cameraFrame);
  const angleErrors: AssessmentAngleError[] = [];
  for (const key of referenceAngles) {
    const cameraKey = sideMode === 'opposite' ? OPPOSITE[key] : key;
    const cameraDeg = camera[cameraKey];
    if (cameraDeg == null) continue;
    const referenceDeg = teacher.angles[key]!;
    const errorDeg = Math.abs(referenceDeg - cameraDeg);
    angleErrors.push({ key, cameraKey, referenceDeg, cameraDeg, errorDeg, score: angleScore(errorDeg, settings.toleranceDeg), weight: settings.weights[key] });
  }
  const comparedWeight = angleErrors.reduce((sum, error) => sum + error.weight, 0);
  const base = {
    comparedAngles: angleErrors.length,
    comparedWeight, expectedWeight,
    coverageRatio: expectedWeight ? comparedWeight / expectedWeight : 0,
    referenceTimeMs: teacher.timeMs,
    angleErrors,
  };
  if (angleErrors.length < minAngles || base.coverageRatio < ASSESSMENT_MIN_COVERAGE
    || settings.requiredAngles.some((key) => camera[sideMode === 'opposite' ? OPPOSITE[key] : key] == null)) {
    return {
      ...unavailable('insufficient_visibility', 'Не видны обязательные суставы или слишком мала видимая часть тела. Измените положение перед камерой.'),
      ...base,
    };
  }
  const score = Math.round(angleErrors.reduce((sum, error) => sum + error.score * error.weight, 0) / comparedWeight);
  const feedback: AssessmentFeedback[] = [];
  for (const group of Object.keys(GROUPS) as AssessmentGroup[]) {
    const { label, angles } = GROUPS[group];
    const errors = angleErrors.filter((error) => angles.includes(error.key));
    if (!errors.length) continue;
    const weight = errors.reduce((sum, error) => sum + error.weight, 0);
    feedback.push({
      group, label, comparedAngles: errors.length,
      score: Math.round(errors.reduce((sum, error) => sum + error.score * error.weight, 0) / weight),
      meanErrorDeg: Math.round(errors.reduce((sum, error) => sum + error.errorDeg * error.weight, 0) / weight),
    });
  }
  return { status: 'scored', message: 'Сравнение с позой тренера', score, feedback, ...base };
}

export interface AssessmentAccumulator {
  activeMs: number;
  scoredMs: number;
  samples: number;
  expectedWeightMs: number;
  comparedWeightMs: number;
  scoreWeightMs: number;
  cameraMissingMs: number;
  cameraPartialMs: number;
  referenceUnavailableMs: number;
}
export interface AssessmentSummary {
  /** Similarity multiplied by joint/time coverage; loss of camera pose cannot inflate it. */
  score: number | null;
  /** Similarity only during successfully compared joint observations. */
  similarityScore: number | null;
  coverageRatio: number;
  activeMs: number;
  scoredMs: number;
  samples: number;
  cameraMissingMs: number;
  cameraPartialMs: number;
  referenceUnavailableMs: number;
  referenceCoverageRatio: number;
}

export function createAssessmentAccumulator(): AssessmentAccumulator {
  return { activeMs: 0, scoredMs: 0, samples: 0, expectedWeightMs: 0, comparedWeightMs: 0, scoreWeightMs: 0, cameraMissingMs: 0, cameraPartialMs: 0, referenceUnavailableMs: 0 };
}

/**
 * Mutates an accumulator. deltaMs must be real playing time since the previous
 * observation, excluding pause, buffering and seek. Long delays are capped so
 * one stale pose cannot receive credit for many seconds.
 */
export function accumulateAssessmentSample(
  accumulator: AssessmentAccumulator,
  result: PoseAssessmentResult,
  deltaMs: number,
): void {
  if (!Number.isFinite(deltaMs) || deltaMs <= 0) return;
  const ms = Math.min(deltaMs, ASSESSMENT_MAX_SAMPLE_MS);
  if (result.status === 'no_reference_pose' || result.status === 'reference_gap') {
    accumulator.referenceUnavailableMs += ms;
    return;
  }
  if (!['scored', 'no_camera_pose', 'insufficient_visibility'].includes(result.status) || result.expectedWeight <= 0) return;
  if (result.status === 'no_camera_pose') accumulator.cameraMissingMs += ms;
  if (result.status === 'insufficient_visibility') accumulator.cameraPartialMs += ms;
  accumulator.samples++;
  accumulator.activeMs += ms;
  accumulator.expectedWeightMs += result.expectedWeight * ms;
  if (result.status !== 'scored' || result.score == null) return;
  accumulator.scoredMs += ms;
  accumulator.comparedWeightMs += result.comparedWeight * ms;
  accumulator.scoreWeightMs += result.score * result.comparedWeight * ms;
}

export function summarizeAssessment(accumulator: AssessmentAccumulator): AssessmentSummary {
  const { activeMs, scoredMs, samples, expectedWeightMs, comparedWeightMs, scoreWeightMs } = accumulator;
  const assessed = comparedWeightMs > 0;
  return {
    score: assessed && expectedWeightMs > 0 ? Math.round(scoreWeightMs / expectedWeightMs) : null,
    similarityScore: assessed ? Math.round(scoreWeightMs / comparedWeightMs) : null,
    coverageRatio: expectedWeightMs > 0 ? comparedWeightMs / expectedWeightMs : 0,
    activeMs, scoredMs, samples,
    cameraMissingMs: accumulator.cameraMissingMs,
    cameraPartialMs: accumulator.cameraPartialMs,
    referenceUnavailableMs: accumulator.referenceUnavailableMs,
    referenceCoverageRatio: activeMs + accumulator.referenceUnavailableMs > 0 ? activeMs / (activeMs + accumulator.referenceUnavailableMs) : 0,
  };
}

/** Raw score remains diagnostic; present the overall result only with sufficient observations. */
export function assessmentSummaryReliability(summary: AssessmentSummary): { reliable: boolean; message: string } {
  if (summary.referenceUnavailableMs > 0 && summary.referenceCoverageRatio < ASSESSMENT_MIN_COVERAGE) {
    return { reliable: false, message: 'Недостаточно пригодных кадров эталона. Проверьте видео и рабочие отрезки.' };
  }
  if (summary.scoredMs < ASSESSMENT_MIN_SCORED_MS) {
    return { reliable: false, message: 'Недостаточно данных для надёжной оценки: нужно хотя бы 3 секунды распознанного выполнения.' };
  }
  if (summary.coverageRatio < ASSESSMENT_MIN_COVERAGE) {
    return { reliable: false, message: 'Недостаточно данных для надёжной оценки: камера видела меньше 75% нужных суставов и рабочего времени.' };
  }
  return { reliable: true, message: 'Данных достаточно для сравнения с эталоном.' };
}

/** Readiness uses the current work profile, or the next one during explanations. */
export function assessmentSettingsAt(reference: PreparedAssessmentReference, timeMs: number): AssessmentSettings {
  const segment = reference.segments.find((s) => timeMs < s.endMs) ?? reference.segments[0];
  return segment?.assessment ?? assessmentPreset();
}
