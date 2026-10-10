import { hasPose, point2d } from './reference';
import { assessmentAngles, ASSESSMENT_MIN_ANGLES, ASSESSMENT_MIN_COVERAGE, type AssessmentSideMode } from './assessment';
import { ASSESSMENT_ANGLES, ASSESSMENT_ANGLE_LABELS, OPPOSITE, REQUIRED_POINTS, type AssessmentSettings } from './assessment-settings';

export const READINESS_HOLD_MS = 3000;
export const READINESS_MAX_GAP_MS = 1000;
export interface ReadinessCheck { good: boolean; message: string }
export interface ReadinessGate {
  sinceMs: number | null;
  lastFrameMs: number | null;
  signature: string;
  ready: boolean;
  secondsLeft: number;
  message: string;
}
export function initialReadiness(): ReadinessGate {
  return { sinceMs: null, lastFrameMs: null, signature: '', ready: false, secondsLeft: 3, message: 'Встаньте перед камерой для проверки видимости.' };
}

/** Visibility/position check, not a requirement to match the trainer's current pose. */
export function checkAssessmentReadiness(frame: number[], settings: AssessmentSettings, sideMode: AssessmentSideMode): ReadinessCheck {
  if (!hasPose(frame)) return { good: false, message: 'Камера не видит человека. Встаньте перед камерой.' };
  const camera = assessmentAngles(frame);
  const mapped = (key: keyof typeof camera) => sideMode === 'opposite' ? OPPOSITE[key] : key;
  const missing = settings.requiredAngles.filter((key) => camera[mapped(key)] == null);
  if (missing.length) return {
    good: false,
    message: `Нужна хорошая видимость: ${missing.map((key) => ASSESSMENT_ANGLE_LABELS[mapped(key)].toLowerCase()).join(', ')}. Отойдите от камеры или измените ракурс.`,
  };
  const clipped = settings.requiredAngles.some((key) => REQUIRED_POINTS[mapped(key)].some((id) => {
    const p = point2d(frame, id);
    return p.x < 0.04 || p.x > 0.96 || p.y < 0.04 || p.y > 0.96;
  }));
  if (clipped) return { good: false, message: 'Отойдите от камеры: нужные части тела слишком близко к краю кадра.' };
  const enabled = ASSESSMENT_ANGLES.filter((key) => settings.weights[key] > 0);
  const visible = enabled.filter((key) => camera[mapped(key)] != null);
  const total = enabled.reduce((sum, key) => sum + settings.weights[key], 0);
  const weight = visible.reduce((sum, key) => sum + settings.weights[key], 0);
  if (visible.length < Math.min(ASSESSMENT_MIN_ANGLES, enabled.length) || weight / total < ASSESSMENT_MIN_COVERAGE) {
    return { good: false, message: 'Видно недостаточно нужных суставов. Отойдите от камеры или измените ракурс.' };
  }
  return { good: true, message: 'Нужные части тела видны. Сохраняйте положение перед камерой.' };
}

/** Every second of countdown needs fresh good frames; one old observation cannot trigger playback. */
export function advanceReadiness(previous: ReadinessGate, check: ReadinessCheck, nowMs: number, signature: string): ReadinessGate {
  if (!check.good || !Number.isFinite(nowMs)) return { ...initialReadiness(), signature, message: check.message };
  const continuous = previous.sinceMs !== null && previous.lastFrameMs !== null
    && signature === previous.signature && nowMs > previous.lastFrameMs && nowMs - previous.lastFrameMs <= READINESS_MAX_GAP_MS;
  const sinceMs = continuous ? previous.sinceMs! : nowMs;
  const remaining = Math.max(0, READINESS_HOLD_MS - (nowMs - sinceMs));
  return {
    sinceMs, lastFrameMs: nowMs, signature, ready: remaining === 0, secondsLeft: Math.ceil(remaining / 1000),
    message: remaining === 0 ? 'Камера готова к тренировке.' : check.message,
  };
}
