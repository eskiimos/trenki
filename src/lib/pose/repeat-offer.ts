import type { Segment } from './segments';
import { parseSegmentRepeat } from './coaching-settings';

/** A structural contract keeps historical segments without repeat settings compatible. */
export type RepeatableSegment = Segment;

export interface RepeatOffer {
  segmentIndex: number;
  seekToMs: number;
  shownAtMs: number;
  expiresAtMs: number;
}
interface PendingOffer {
  segmentIndex: number;
  seekToMs: number;
  dueAtMs: number;
  durationMs: number;
  signature: string;
  shownAtMs: number | null;
}
export interface RepeatOfferState {
  previous: { mediaMs: number; nowMs: number } | null;
  activeIndex: number | null;
  pending: PendingOffer | null;
}

export function createRepeatOfferState(): RepeatOfferState {
  return { previous: null, activeIndex: null, pending: null };
}
export function resetRepeatOffers(state: RepeatOfferState): void { Object.assign(state, createRepeatOfferState()); }

export interface RepeatOfferInput {
  segments: RepeatableSegment[];
  mediaMs: number;
  nowMs: number;
  playing: boolean;
  enabled: boolean;
  playbackRate?: number;
  /** True only for a natural video end, not manual finish. Keeps a last-set offer alive. */
  ended?: boolean;
}

const tracked = (segment: RepeatableSegment) => segment.assessment?.enabled !== false;
const signature = (segment: RepeatableSegment) => JSON.stringify([segment.startMs, segment.endMs, segment.repeat, segment.assessment]);
const repeatIsValid = (segment: RepeatableSegment) => {
  const rules = segment.repeat;
  return !!rules?.enabled && parseSegmentRepeat(rules, segment.startMs) !== null;
};

/** Offers only after an observed, continuous forward crossing; this never seeks itself. */
export function advanceRepeatOffer(state: RepeatOfferState, input: RepeatOfferInput): RepeatOffer | null {
  const { mediaMs, nowMs, segments } = input;
  const rate = input.playbackRate ?? 1;
  if (!input.enabled || (!input.playing && !input.ended) || !Number.isFinite(mediaMs) || mediaMs < 0
    || !Number.isFinite(nowMs) || nowMs < 0 || !Number.isFinite(rate) || rate <= 0) {
    resetRepeatOffers(state);
    return null;
  }
  const currentIndex = segments.findIndex(segment => tracked(segment) && mediaMs >= segment.startMs && mediaMs < segment.endMs);
  const previous = state.previous;
  if (previous) {
    const elapsed = nowMs - previous.nowMs;
    const videoElapsed = mediaMs - previous.mediaMs;
    const continuous = elapsed >= 0 && elapsed <= 1500 && videoElapsed >= 0 && (elapsed > 0 || videoElapsed === 0)
      && (input.ended && videoElapsed === 0 || Math.abs(videoElapsed - elapsed * rate) <= 350);
    if (!continuous) resetRepeatOffers(state);
  }
  // A direct seek into an already completed interval cannot create a candidate.
  if (state.previous && state.activeIndex !== null) {
    const segment = segments[state.activeIndex];
    if (segment && tracked(segment) && repeatIsValid(segment)
      && state.previous.mediaMs < segment.endMs && mediaMs >= segment.endMs) {
      state.pending = {
        segmentIndex: state.activeIndex, seekToMs: segment.repeat!.seekToMs,
        dueAtMs: nowMs + segment.repeat!.promptDelayMs, durationMs: segment.repeat!.promptDurationMs,
        signature: signature(segment), shownAtMs: null,
      };
    }
  }
  state.previous = { mediaMs, nowMs };
  state.activeIndex = currentIndex < 0 ? null : currentIndex;
  const pending = state.pending;
  if (!pending) return null;
  const segment = segments[pending.segmentIndex];
  if (!segment || !tracked(segment) || !repeatIsValid(segment) || signature(segment) !== pending.signature
    || (currentIndex >= 0 && currentIndex !== pending.segmentIndex)) {
    state.pending = null;
    return null;
  }
  if (nowMs < pending.dueAtMs) return null;
  pending.shownAtMs ??= nowMs;
  const expiresAtMs = pending.shownAtMs + pending.durationMs;
  if (nowMs >= expiresAtMs) { state.pending = null; return null; }
  return { segmentIndex: pending.segmentIndex, seekToMs: pending.seekToMs, shownAtMs: pending.shownAtMs, expiresAtMs };
}
