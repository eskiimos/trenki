export type PlaybackMode = 'training' | 'view';

/** Training permits repetition; only free viewing permits skipping ahead. */
export function getPlaybackPermissions(fromWorkout: boolean, mode: PlaybackMode) {
  const freeViewing = !fromWorkout && mode === 'view';
  return { canRewind: true, canSeekForward: freeViewing, canScrub: freeViewing } as const;
}

export interface PlaybackSeekIntent {
  kind: 'restore' | 'rewind';
  fromSec: number;
  targetSec: number;
  issuedAtMs: number;
}

export interface PlaybackSeekInput {
  /** Last stable position before this seek; do not advance it while seeking. */
  fromSec: number;
  toSec: number;
  allowForward: boolean;
  intent?: PlaybackSeekIntent | null;
  nowMs: number;
}

export interface PlaybackSeekDecision {
  kind: 'restore' | 'backward' | 'forward' | 'stationary' | 'invalid';
  allowed: boolean;
  invalidatesCredit: boolean;
  restoreToSec: number | null;
}

const POSITION_EPSILON_SEC = 0.1;
const INTENT_LIFETIME_MS = 2_000;
const isPosition = (value: number) => Number.isFinite(value) && value >= 0;

/**
 * Call once on `seeking`, consume the supplied intent, and keep this decision
 * until `seeked`. Loading the target may take longer than the intent lifetime.
 * A restoration is trusted only for its exact, freshly requested target;
 * an old programmatic flag must not authorize a later native-player seek.
 */
export function evaluatePlaybackSeek(input: PlaybackSeekInput): PlaybackSeekDecision {
  const { fromSec, toSec, allowForward, intent, nowMs } = input;
  if (!isPosition(fromSec) || !isPosition(toSec)) {
    return { kind: 'invalid', allowed: false, invalidatesCredit: true, restoreToSec: isPosition(fromSec) ? fromSec : null };
  }

  const intentMatches = !!intent
    && isPosition(intent.fromSec)
    && isPosition(intent.targetSec)
    && Number.isFinite(intent.issuedAtMs)
    && Number.isFinite(nowMs)
    && nowMs >= intent.issuedAtMs
    && nowMs - intent.issuedAtMs <= INTENT_LIFETIME_MS
    && Math.abs(toSec - intent.targetSec) <= POSITION_EPSILON_SEC;

  if (intentMatches && intent.kind === 'restore') {
    return { kind: 'restore', allowed: true, invalidatesCredit: false, restoreToSec: null };
  }

  // An explicit rewind uses the player's position at the click. The last
  // timeupdate can be stale (e.g. after backgrounding), so do not mistake a
  // valid rewind from 55 to 45 for a forward seek from an older 40-second tick.
  const origin = intentMatches && intent.kind === 'rewind' && intent.targetSec <= intent.fromSec
    ? intent.fromSec
    : fromSec;
  if (toSec < origin - POSITION_EPSILON_SEC) {
    return { kind: 'backward', allowed: true, invalidatesCredit: false, restoreToSec: null };
  }
  if (toSec <= origin + POSITION_EPSILON_SEC) {
    return { kind: 'stationary', allowed: true, invalidatesCredit: false, restoreToSec: null };
  }
  return {
    kind: 'forward',
    allowed: allowForward,
    invalidatesCredit: true,
    restoreToSec: allowForward ? null : fromSec,
  };
}

export function rewindPlaybackTarget(currentSec: number, seconds = 10): number {
  if (!isPosition(currentSec)) return 0;
  if (!Number.isFinite(seconds) || seconds <= 0) return currentSec;
  return Math.max(0, currentSec - seconds);
}
