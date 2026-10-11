import type { PoseAssessmentResult } from './assessment';
import { ASSESSMENT_ANGLE_LABELS, REQUIRED_POINTS, type AssessmentAngleKey } from './assessment-settings';
export interface FeedbackState {
  lastMs: number | null;
  smoothScore: number | null;
  joints: Partial<Record<AssessmentAngleKey, { error: number; sinceMs: number | null }>>;
  primary: AssessmentAngleKey | null;
}
export interface LiveFeedback { score: number | null; message: string; cameraJoints: AssessmentAngleKey[]; referenceJoints: AssessmentAngleKey[] }
export const createFeedbackState = (): FeedbackState => ({ lastMs: null, smoothScore: null, joints: {}, primary: null });
/** Smooth display only. Accumulators always receive the original, unsmoothed results. */
export function updateLiveFeedback(state: FeedbackState, result: PoseAssessmentResult, nowMs: number, toleranceDeg: number): LiveFeedback {
  const last = state.lastMs;
  if (result.status !== 'scored' || result.score === null || !Number.isFinite(nowMs)) {
    Object.assign(state, createFeedbackState());
    return { score: null, message: result.message, cameraJoints: [], referenceJoints: [] };
  }
  if (last !== null && (nowMs <= last || nowMs - last > 600)) Object.assign(state, createFeedbackState());
  const elapsed = state.lastMs === null ? 0 : nowMs - state.lastMs;
  const alpha = state.lastMs === null ? 1 : 1 - Math.exp(-elapsed / 400);
  state.lastMs = nowMs;
  state.smoothScore = state.smoothScore === null ? result.score : state.smoothScore + alpha * (result.score - state.smoothScore);
  const present = new Set(result.angleErrors.map(e => e.cameraKey));
  for (const key of Object.keys(state.joints) as AssessmentAngleKey[]) if (!present.has(key)) delete state.joints[key];
  const persistent: Array<{ key: AssessmentAngleKey; referenceKey: AssessmentAngleKey; error: number }> = [];
  for (const error of result.angleErrors) {
    const previous = state.joints[error.cameraKey];
    const smoothed = previous ? previous.error + alpha * (error.errorDeg - previous.error) : error.errorDeg;
    const sinceMs = smoothed > Math.max(15, toleranceDeg + 10) ? previous?.sinceMs ?? nowMs : null;
    state.joints[error.cameraKey] = { error: smoothed, sinceMs };
    if (sinceMs !== null && nowMs - sinceMs >= 800) persistent.push({ key: error.cameraKey, referenceKey: error.key, error: smoothed });
  }
  persistent.sort((a, b) => b.error - a.error);
  const held = persistent.find(e => e.key === state.primary);
  const primary = held && (!persistent[0] || held.error + 8 >= persistent[0].error) ? held : persistent[0];
  state.primary = primary?.key ?? null;
  const selected = persistent.slice(0, 3);
  return {
    score: Math.round(state.smoothScore),
    message: primary ? `Сверьтесь с тренером: ${ASSESSMENT_ANGLE_LABELS[primary.key].toLowerCase()}.`
      : state.smoothScore >= 80 ? 'Движение похоже. Продолжайте повторять за тренером.' : 'Продолжайте повторять за тренером.',
    cameraJoints: selected.map(e => e.key), referenceJoints: selected.map(e => e.referenceKey),
  };
}
export function highlightPoints(keys: AssessmentAngleKey[]): number[] {
  return [...new Set(keys.flatMap(key => key === 'trunk' ? REQUIRED_POINTS[key] : [REQUIRED_POINTS[key][1]!]))];
}
