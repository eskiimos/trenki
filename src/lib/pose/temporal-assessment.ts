import { evaluatePoseAssessment, type AssessmentSideMode, type PoseAssessmentResult, type PreparedAssessmentReference } from './assessment';
import { ASSESSMENT_ANGLES } from './assessment-settings';

export const ALIGNMENT_LIMIT_MS = 300;
const WINDOW_MS = 2400;
interface Observation { frame: number[]; mediaMs: number; capturedAtMs: number }
export interface TemporalState {
  observations: Observation[];
  signature: string;
  lastEstimateMs: number;
  adjustmentMs: number;
  tempoScore: number | null;
}
export const createTemporalState = (): TemporalState => ({ observations: [], signature: '', lastEstimateMs: -Infinity, adjustmentMs: 0, tempoScore: null });
export interface TemporalAssessment {
  result: PoseAssessmentResult;
  delayMs: number;
  adjustmentMs: number;
  tempoScore: number | null;
}
const sameJoints = (a: PoseAssessmentResult, b: PoseAssessmentResult) => a.expectedWeight === b.expectedWeight
  && a.angleErrors.map(e => e.key).join() === b.angleErrors.map(e => e.key).join();
const cost = (result: PoseAssessmentResult) => result.angleErrors.reduce((sum, e) => sum + e.errorDeg * e.weight, 0) / result.comparedWeight;

/** Estimate one lag for a moving window, never select the best pose independently per frame. */
export function evaluateTemporalAssessment(state: TemporalState, reference: PreparedAssessmentReference, frame: number[], mediaMs: number, capturedAtMs: number,
  baseDelayMs: number, side: AssessmentSideMode, automatic = true, playbackRate = 1): TemporalAssessment {
  const rate = Number.isFinite(playbackRate) && playbackRate > 0 ? playbackRate : 1;
  const base = Math.min(1500, Math.max(0, Number.isFinite(baseDelayMs) ? baseDelayMs : 500)) * rate;
  const timeMs = mediaMs - base;
  const segment = reference.segments.find(s => timeMs >= s.startMs && timeMs < s.endMs);
  const raw = evaluatePoseAssessment(reference, frame, timeMs, side);
  const signature = JSON.stringify({ segment, base, rate, side, automatic });
  const last = state.observations.at(-1);
  if (signature !== state.signature || !Number.isFinite(capturedAtMs) || !Number.isFinite(mediaMs)
    || (last && (capturedAtMs <= last.capturedAtMs || capturedAtMs - last.capturedAtMs > 600
      || mediaMs <= last.mediaMs || Math.abs(mediaMs - last.mediaMs - (capturedAtMs - last.capturedAtMs) * rate) > 200))) {
    Object.assign(state, createTemporalState(), { signature });
  }
  const empty = (): TemporalAssessment => ({ result: raw, delayMs: base, adjustmentMs: 0, tempoScore: null });
  // Alignment cannot rescue missing bodies, missing reference data or rest periods.
  if (raw.status !== 'scored' || !segment || !Number.isFinite(capturedAtMs)) {
    Object.assign(state, createTemporalState(), { signature });
    return empty();
  }
  state.observations.push({ frame, mediaMs, capturedAtMs });
  state.observations = state.observations.filter(o => capturedAtMs - o.capturedAtMs <= WINDOW_MS).slice(-30);
  if (capturedAtMs - state.lastEstimateMs >= 500) {
    state.lastEstimateMs = capturedAtMs;
    state.tempoScore = null;
    state.adjustmentMs = 0;
    const observations = state.observations;
    if (observations.length >= 8 && capturedAtMs - observations[0]!.capturedAtMs >= 1200) {
      const candidates: Array<{ delay: number; error: number; results: PoseAssessmentResult[] }> = [];
      const low = Math.max(0, base - ALIGNMENT_LIMIT_MS * rate), high = Math.min(1500 * rate, base + ALIGNMENT_LIMIT_MS * rate);
      const delays = new Set([base]);
      for (let delay = low; delay <= high; delay += 50 * rate) delays.add(delay);
      const baseline = observations.map(o => evaluatePoseAssessment(reference, o.frame, o.mediaMs - base, side));
      for (const delay of delays) {
        // No future frame, no crossing the work interval or its profile boundary.
        if (observations.some(o => o.mediaMs - delay < segment.startMs || o.mediaMs - delay >= segment.endMs)) continue;
        const results = observations.map(o => evaluatePoseAssessment(reference, o.frame, o.mediaMs - delay, side));
        if (results.some((r, i) => r.status !== 'scored' || !sameJoints(r, baseline[i]!))) continue;
        candidates.push({ delay, error: results.reduce((s, r) => s + cost(r), 0) / results.length, results });
      }
      candidates.sort((a, b) => a.error - b.error || Math.abs(a.delay - base) - Math.abs(b.delay - base));
      const best = candidates[0];
      const separated = best && candidates.filter(c => Math.abs(c.delay - best.delay) >= 200 * rate);
      // Require movement in both bodies on at least one shared enabled joint.
      const moving = best && ASSESSMENT_ANGLES.some(key => {
        const errors = best.results.map(r => r.angleErrors.find(e => e.key === key));
        if (errors.some(e => !e)) return false;
        const teacher = errors.map(e => e!.referenceDeg), camera = errors.map(e => e!.cameraDeg);
        return Math.max(...teacher) - Math.min(...teacher) >= 12 && Math.max(...camera) - Math.min(...camera) >= 8;
      });
      if (best && best.delay > low && best.delay < high && moving && best.error <= 20 && separated?.length && Math.min(...separated.map(c => c.error)) - best.error >= 1) {
        const delta = best.delay - base;
        state.adjustmentMs = delta / rate;
        // Synchrony relative to configured reaction time, not repetitions/minute.
        state.tempoScore = Math.round(100 * (1 - Math.max(0, Math.abs(delta / rate) - 75) / 225));
      }
    }
  }
  const applied = automatic && state.tempoScore !== null ? state.adjustmentMs : 0;
  const target = mediaMs - base - applied * rate;
  if (target < segment.startMs || target >= segment.endMs) return empty();
  const result = applied ? evaluatePoseAssessment(reference, frame, target, side) : raw;
  if (result.status !== 'scored' || !sameJoints(result, raw)) return empty();
  return { result, delayMs: base + applied * rate, adjustmentMs: applied, tempoScore: state.tempoScore };
}

export interface TempoAccumulator { scoredMs: number; weightedScore: number }
export const createTempoAccumulator = (): TempoAccumulator => ({ scoredMs: 0, weightedScore: 0 });
export function accumulateTempo(acc: TempoAccumulator, score: number | null, ms: number) {
  if (score === null || !Number.isFinite(score) || !Number.isFinite(ms) || ms <= 0) return;
  const duration = Math.min(ms, 500);
  acc.scoredMs += duration; acc.weightedScore += Math.min(100, Math.max(0, score)) * duration;
}
export function summarizeTempo(acc: TempoAccumulator): number | null {
  return acc.scoredMs >= 3000 ? Math.round(acc.weightedScore / acc.scoredMs) : null;
}
