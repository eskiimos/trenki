import { describe, expect, it } from 'vitest';
import { evaluatePlaybackSeek, getPlaybackPermissions, rewindPlaybackTarget, type PlaybackSeekInput } from '../../src/lib/training/playback-policy';

const evaluate = (changes: Partial<PlaybackSeekInput> = {}) => evaluatePlaybackSeek({
  fromSec: 40, toSec: 30, allowForward: false, nowMs: 1_000, ...changes,
});

describe('athlete playback permissions', () => {
  it('allows repetition in both quick-workout and standalone training without enabling forward skipping', () => {
    for (const fromWorkout of [true, false]) {
      expect(getPlaybackPermissions(fromWorkout, 'training')).toEqual({ canRewind: true, canSeekForward: false, canScrub: false });
    }
    // A stale standalone mode cannot unlock a workout-session player.
    expect(getPlaybackPermissions(true, 'view')).toEqual({ canRewind: true, canSeekForward: false, canScrub: false });
    expect(getPlaybackPermissions(false, 'view')).toEqual({ canRewind: true, canSeekForward: true, canScrub: true });
  });

  it('bounds repeated rewind taps at the start and rejects unusable positions', () => {
    expect(rewindPlaybackTarget(35)).toBe(25);
    expect(rewindPlaybackTarget(5)).toBe(0);
    expect(rewindPlaybackTarget(rewindPlaybackTarget(5))).toBe(0);
    expect(rewindPlaybackTarget(35, 5)).toBe(30);
    expect(rewindPlaybackTarget(35, -5)).toBe(35);
    expect(rewindPlaybackTarget(Number.NaN)).toBe(0);
    expect(rewindPlaybackTarget(Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe('seek accounting in athlete training', () => {
  it('preserves credit eligibility after a backward button, native backward seek or repeated approach', () => {
    expect(evaluate()).toEqual({ kind: 'backward', allowed: true, invalidatesCredit: false, restoreToSec: null });
    expect(evaluate({ toSec: 0 }).invalidatesCredit).toBe(false);
    expect(evaluate({ fromSec: 30, toSec: 20 }).allowed).toBe(true);
  });

  it('rejects an unrequested native forward seek in training and keeps the old position for restoration', () => {
    expect(evaluate({ toSec: 80 })).toEqual({ kind: 'forward', allowed: false, invalidatesCredit: true, restoreToSec: 40 });
  });

  it('permits viewing-mode forward seeking but keeps the pass ineligible when switching back to training', () => {
    expect(evaluate({ toSec: 80, allowForward: true })).toEqual({ kind: 'forward', allowed: true, invalidatesCredit: true, restoreToSec: null });
  });

  it('allows a correlated resume or quality restoration without confusing it with forward skipping', () => {
    const intent = { kind: 'restore' as const, fromSec: 0, targetSec: 120, issuedAtMs: 500 };
    expect(evaluate({ fromSec: 0, toSec: 120, intent })).toEqual({ kind: 'restore', allowed: true, invalidatesCredit: false, restoreToSec: null });
    expect(evaluate({ fromSec: 0, toSec: 120.02, intent }).kind).toBe('restore');
  });

  it('does not let stale, mismatched or clock-invalid restoration intents authorize another native seek', () => {
    const intent = { kind: 'restore' as const, fromSec: 0, targetSec: 120, issuedAtMs: 500 };
    for (const changes of [
      { toSec: 140 },
      { nowMs: 3_000 },
      { nowMs: 499 },
      { nowMs: Number.NaN },
    ]) {
      expect(evaluate({ fromSec: 0, toSec: 120, intent, ...changes })).toMatchObject({ kind: 'forward', allowed: false, invalidatesCredit: true });
    }
  });

  it('uses an explicit rewind origin when the last timeupdate was stale', () => {
    const intent = { kind: 'rewind' as const, fromSec: 55, targetSec: 45, issuedAtMs: 900 };
    expect(evaluate({ fromSec: 40, toSec: 45, intent })).toMatchObject({ kind: 'backward', allowed: true, invalidatesCredit: false });
    // A mislabeled forward command is never trusted as repetition.
    expect(evaluate({ fromSec: 40, toSec: 65, intent: { ...intent, targetSec: 65 } })).toMatchObject({ kind: 'forward', allowed: false, invalidatesCredit: true });
  });

  it('ignores sub-frame landing differences and fails closed for invalid positions', () => {
    expect(evaluate({ toSec: 40.02 })).toMatchObject({ kind: 'stationary', allowed: true, invalidatesCredit: false });
    expect(evaluate({ toSec: Number.NaN })).toMatchObject({ kind: 'invalid', allowed: false, restoreToSec: 40 });
    expect(evaluate({ fromSec: Number.NaN })).toMatchObject({ kind: 'invalid', allowed: false, restoreToSec: null });
  });
});
