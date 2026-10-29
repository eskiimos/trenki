import { describe, expect, it } from 'vitest';
import { advanceRepeatOffer, createRepeatOfferState, resetRepeatOffers, type RepeatableSegment } from '../../src/lib/pose/repeat-offer';
import { assessmentPreset } from '../../src/lib/pose/assessment-settings';

const segment = (): RepeatableSegment => ({ startMs: 10000, endMs: 20000, repeat: { enabled: true, seekToMs: 0, promptDelayMs: 7000, promptDurationMs: 5000 } });
const next = () => ({ startMs: 40000, endMs: 50000 });

describe('repeat approach offer scheduler', () => {
  it('waits seven seconds after a continuous crossing and shows for five seconds', () => {
    const state = createRepeatOfferState(), segments = [segment(), next()];
    const tick = (mediaMs: number) => advanceRepeatOffer(state, { segments, mediaMs, nowMs: mediaMs, playing: true, enabled: true });
    expect(tick(19500)).toBeNull(); expect(tick(20000)).toBeNull();
    for (let t = 20500; t < 27000; t += 500) expect(tick(t)).toBeNull();
    expect(tick(27000)).toEqual({ segmentIndex: 0, seekToMs: 0, shownAtMs: 27000, expiresAtMs: 32000 });
    expect(tick(28000)?.segmentIndex).toBe(0);
    for (let t = 28500; t < 32000; t += 500) expect(tick(t)).not.toBeNull();
    expect(tick(32000)).toBeNull(); expect(tick(32500)).toBeNull();
  });
  it('does not treat a seek past the end or an initial position past the end as completion', () => {
    const state = createRepeatOfferState(), segments = [segment()];
    expect(advanceRepeatOffer(state, { segments, mediaMs: 27000, nowMs: 0, playing: true, enabled: true })).toBeNull();
    resetRepeatOffers(state);
    advanceRepeatOffer(state, { segments, mediaMs: 11000, nowMs: 100, playing: true, enabled: true });
    expect(advanceRepeatOffer(state, { segments, mediaMs: 21000, nowMs: 200, playing: true, enabled: true })).toBeNull();
    expect(state.pending).toBeNull();
  });
  it('cancels for pause, hidden/buffering disable and a newly started exercise', () => {
    for (const cancel of ['pause', 'disable', 'next'] as const) {
      const state = createRepeatOfferState(), segments = [segment(), { startMs: 20500, endMs: 30000 }];
      advanceRepeatOffer(state, { segments, mediaMs: 19500, nowMs: 0, playing: true, enabled: true });
      advanceRepeatOffer(state, { segments, mediaMs: 20000, nowMs: 500, playing: true, enabled: true });
      expect(state.pending).not.toBeNull();
      expect(advanceRepeatOffer(state, { segments, mediaMs: 20500, nowMs: 1000, playing: cancel !== 'pause', enabled: cancel !== 'disable' })).toBeNull();
      expect(state.pending).toBeNull();
    }
  });
  it('offers only explicitly enabled, valid repeatable exercise segments', () => {
    const disabledAssessment = { ...assessmentPreset(), enabled: false };
    for (const s of [
      { ...segment(), repeat: undefined },
      { ...segment(), repeat: { ...segment().repeat!, enabled: false } },
      { ...segment(), repeat: { ...segment().repeat!, seekToMs: 11000 } },
      { ...segment(), assessment: disabledAssessment },
    ]) {
      const state = createRepeatOfferState();
      advanceRepeatOffer(state, { segments: [s], mediaMs: 19500, nowMs: 0, playing: true, enabled: true });
      advanceRepeatOffer(state, { segments: [s], mediaMs: 20000, nowMs: 500, playing: true, enabled: true });
      expect(state.pending).toBeNull();
    }
  });
  it('does not cancel an offer merely because a following theory segment begins', () => {
    const state = createRepeatOfferState(), s = segment();
    s.repeat!.promptDelayMs = 0;
    const segments = [s, { startMs: 20000, endMs: 30000, assessment: { ...assessmentPreset(), enabled: false } }];
    advanceRepeatOffer(state, { segments, mediaMs: 19500, nowMs: 0, playing: true, enabled: true });
    expect(advanceRepeatOffer(state, { segments, mediaMs: 20000, nowMs: 500, playing: true, enabled: true })?.seekToMs).toBe(0);
  });
  it('a replay/rewind permits a later completion to offer again without automatic seeks', () => {
    const state = createRepeatOfferState(), s = segment(); s.repeat!.promptDelayMs = 0;
    const tick = (mediaMs: number, nowMs: number) => advanceRepeatOffer(state, { segments: [s], mediaMs, nowMs, playing: true, enabled: true });
    tick(19500, 0); expect(tick(20000, 500)).not.toBeNull();
    expect(tick(0, 600)).toBeNull(); expect(state.pending).toBeNull();
    tick(19500, 1000); expect(tick(20000, 1500)).not.toBeNull();
  });
  it('keeps the final-set offer after natural end, but manual finish cancels it', () => {
    const state = createRepeatOfferState(), segments = [segment()];
    advanceRepeatOffer(state, { segments, mediaMs: 19500, nowMs: 0, playing: true, enabled: true });
    advanceRepeatOffer(state, { segments, mediaMs: 20000, nowMs: 500, playing: false, ended: true, enabled: true });
    for (let now = 1000; now < 7500; now += 500) advanceRepeatOffer(state, { segments, mediaMs: 20000, nowMs: now, playing: false, ended: true, enabled: true });
    expect(advanceRepeatOffer(state, { segments, mediaMs: 20000, nowMs: 7500, playing: false, ended: true, enabled: true })?.segmentIndex).toBe(0);
    expect(advanceRepeatOffer(state, { segments, mediaMs: 20000, nowMs: 7600, playing: false, enabled: false })).toBeNull();
  });
  it('invalidates pending offers when settings change and does not resume them after large gaps', () => {
    const state = createRepeatOfferState(), s = segment();
    advanceRepeatOffer(state, { segments: [s], mediaMs: 19500, nowMs: 0, playing: true, enabled: true });
    advanceRepeatOffer(state, { segments: [s], mediaMs: 20000, nowMs: 500, playing: true, enabled: true });
    s.repeat!.seekToMs = 5000;
    advanceRepeatOffer(state, { segments: [s], mediaMs: 20500, nowMs: 1000, playing: true, enabled: true });
    expect(state.pending).toBeNull();
    resetRepeatOffers(state);
    advanceRepeatOffer(state, { segments: [s], mediaMs: 19500, nowMs: 0, playing: true, enabled: true });
    advanceRepeatOffer(state, { segments: [s], mediaMs: 20000, nowMs: 500, playing: true, enabled: true });
    expect(advanceRepeatOffer(state, { segments: [s], mediaMs: 28000, nowMs: 8500, playing: true, enabled: true })).toBeNull();
    expect(state.pending).toBeNull();
  });
  it('uses wall time for the prompt at a non-default playback rate', () => {
    const state = createRepeatOfferState(), s = segment(); s.repeat!.promptDelayMs = 1000;
    const tick = (mediaMs: number, nowMs: number) => advanceRepeatOffer(state, { segments: [s], mediaMs, nowMs, playing: true, enabled: true, playbackRate: 2 });
    tick(19000, 0); tick(20000, 500); tick(21000, 1000);
    expect(tick(22000, 1500)?.shownAtMs).toBe(1500);
  });
  it('keeps an offer when a native end event repeats the last timestamp', () => {
    const state = createRepeatOfferState(), s = segment(); s.repeat!.promptDelayMs = 0;
    advanceRepeatOffer(state, { segments: [s], mediaMs: 19500, nowMs: 0, playing: true, enabled: true });
    const offer = advanceRepeatOffer(state, { segments: [s], mediaMs: 20000, nowMs: 500, playing: true, enabled: true });
    expect(offer).not.toBeNull();
    expect(advanceRepeatOffer(state, { segments: [s], mediaMs: 20000, nowMs: 500, playing: false, ended: true, enabled: true })).toEqual(offer);
  });
});
