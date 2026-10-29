import { LM, type AngleKey } from './reference';

export type AssessmentAngleKey = AngleKey | 'shoulderL' | 'shoulderR';
export const ASSESSMENT_ANGLES: AssessmentAngleKey[] = [
  'kneeL', 'kneeR', 'hipL', 'hipR', 'elbowL', 'elbowR', 'shoulderL', 'shoulderR', 'trunk',
];
export const ASSESSMENT_ANGLE_LABELS: Record<AssessmentAngleKey, string> = {
  kneeL: 'Левое колено', kneeR: 'Правое колено', hipL: 'Левый тазобедренный', hipR: 'Правый тазобедренный',
  elbowL: 'Левый локоть', elbowR: 'Правый локоть', shoulderL: 'Левое плечо', shoulderR: 'Правое плечо', trunk: 'Корпус',
};
export const ASSESSMENT_PROFILES = {
  balanced: 'Всё тело', legs: 'Ноги и корпус', arms: 'Руки и плечи', core: 'Корпус', custom: 'Свои настройки',
} as const;
export type AssessmentProfile = keyof typeof ASSESSMENT_PROFILES;
export interface AssessmentSettings {
  /** Omitted on historical annotations; false marks theory/non-biomechanical work. */
  enabled?: boolean;
  profile: AssessmentProfile;
  weights: Record<AssessmentAngleKey, number>;
  requiredAngles: AssessmentAngleKey[];
  toleranceDeg: number;
}

export const REQUIRED_POINTS: Record<AssessmentAngleKey, number[]> = {
  kneeL: [LM.lHip, LM.lKnee, LM.lAnkle], kneeR: [LM.rHip, LM.rKnee, LM.rAnkle],
  hipL: [LM.lShoulder, LM.lHip, LM.lKnee], hipR: [LM.rShoulder, LM.rHip, LM.rKnee],
  elbowL: [LM.lShoulder, LM.lElbow, LM.lWrist], elbowR: [LM.rShoulder, LM.rElbow, LM.rWrist],
  shoulderL: [LM.lHip, LM.lShoulder, LM.lElbow], shoulderR: [LM.rHip, LM.rShoulder, LM.rElbow],
  trunk: [LM.lShoulder, LM.rShoulder, LM.lHip, LM.rHip],
};
export const OPPOSITE: Record<AssessmentAngleKey, AssessmentAngleKey> = {
  kneeL: 'kneeR', kneeR: 'kneeL', hipL: 'hipR', hipR: 'hipL', elbowL: 'elbowR', elbowR: 'elbowL',
  shoulderL: 'shoulderR', shoulderR: 'shoulderL', trunk: 'trunk',
};

/** Whitelist points used by the enabled angles; shared hip/shoulder points are retained. */
export function visibleAssessmentPoints(settings: AssessmentSettings, sideMode: 'same' | 'opposite' = 'same'): number[] {
  if (settings.enabled === false) return [];
  return [...new Set(ASSESSMENT_ANGLES.filter((key) => settings.weights[key] > 0)
    .flatMap((key) => REQUIRED_POINTS[sideMode === 'opposite' ? OPPOSITE[key] : key]))].sort((a, b) => a - b);
}
/** Missing settings on existing references use this explicit, conservative default. */
export function assessmentPreset(profile: Exclude<AssessmentProfile, 'custom'> = 'balanced'): AssessmentSettings {
  const weights: Record<AssessmentAngleKey, number> = {
    kneeL: 1, kneeR: 1, hipL: 1, hipR: 1, elbowL: 0.75, elbowR: 0.75, shoulderL: 1, shoulderR: 1, trunk: 1,
  };
  let requiredAngles: AssessmentAngleKey[] = ['kneeL', 'kneeR', 'hipL', 'hipR', 'shoulderL', 'shoulderR'];
  if (profile === 'legs') {
    Object.assign(weights, { kneeL: 2, kneeR: 2, hipL: 2, hipR: 2, elbowL: 0, elbowR: 0, shoulderL: 0, shoulderR: 0 });
    requiredAngles = ['kneeL', 'kneeR', 'hipL', 'hipR'];
  } else if (profile === 'arms') {
    Object.assign(weights, { kneeL: 0, kneeR: 0, hipL: 0, hipR: 0, elbowL: 2, elbowR: 2, shoulderL: 2, shoulderR: 2 });
    requiredAngles = ['elbowL', 'elbowR', 'shoulderL', 'shoulderR'];
  } else if (profile === 'core') {
    for (const key of ASSESSMENT_ANGLES) weights[key] = key === 'trunk' ? 3 : 0;
    requiredAngles = ['trunk'];
  }
  return { profile, weights, requiredAngles, toleranceDeg: 5 };
}

/** Strict boundary for API/JSON input. Unknown or incomplete rules never silently become defaults. */
export function parseAssessmentSettings(raw: unknown): AssessmentSettings | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;
  if ('enabled' in value && typeof value.enabled !== 'boolean') return null;
  if (typeof value.profile !== 'string' || !Object.hasOwn(ASSESSMENT_PROFILES, value.profile)) return null;
  if (typeof value.toleranceDeg !== 'number' || !Number.isFinite(value.toleranceDeg) || value.toleranceDeg < 0 || value.toleranceDeg > 30) return null;
  if (!value.weights || typeof value.weights !== 'object' || Array.isArray(value.weights)) return null;
  const input = value.weights as Record<string, unknown>;
  if (Object.keys(input).some((key) => !ASSESSMENT_ANGLES.includes(key as AssessmentAngleKey))) return null;
  const weights = {} as Record<AssessmentAngleKey, number>;
  for (const key of ASSESSMENT_ANGLES) {
    const weight = input[key];
    if (typeof weight !== 'number' || !Number.isFinite(weight) || weight < 0 || weight > 5) return null;
    weights[key] = weight;
  }
  if (!Array.isArray(value.requiredAngles) || (value.enabled !== false && !value.requiredAngles.length) || value.requiredAngles.length > ASSESSMENT_ANGLES.length) return null;
  if (value.requiredAngles.some((key) => !ASSESSMENT_ANGLES.includes(key) || weights[key as AssessmentAngleKey] <= 0)) return null;
  const inputRequired = value.requiredAngles;
  const requiredAngles = ASSESSMENT_ANGLES.filter((key) => inputRequired.includes(key));
  return { profile: value.profile as AssessmentProfile, weights, requiredAngles, toleranceDeg: value.toleranceDeg,
    ...('enabled' in value ? { enabled: value.enabled as boolean } : {}) };
}
