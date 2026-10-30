'use client';

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { advanceRepeatOffer, createRepeatOfferState, resetRepeatOffers, type RepeatOffer } from '@/lib/pose/repeat-offer';
import type { PlaybackRepeatSegment } from '@/lib/training/repeat-settings';

interface Options {
  videoRef: RefObject<HTMLVideoElement | null>;
  mediaKey: string;
  segments: PlaybackRepeatSegment[];
  enabled: boolean;
  onEndReady: () => Promise<boolean>;
}

/** Timing only: ordinary workouts never load pose frames or start a camera. */
export function useWorkoutRepeat({ videoRef, mediaKey, segments, enabled, onEndReady }: Options) {
  const [offer, setOffer] = useState<RepeatOffer | null>(null);
  const [waitingAtEnd, setWaitingAtEnd] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [completionFailed, setCompletionFailed] = useState(false);
  const state = useRef(createRepeatOfferState());
  const naturalEnd = useRef(false);
  const committedEnd = useRef(false);
  const callback = useRef(onEndReady);
  const revision = useRef(0);
  useEffect(() => { callback.current = onEndReady; }, [onEndReady]);

  const clear = useCallback(() => {
    revision.current++;
    resetRepeatOffers(state.current);
    naturalEnd.current = false;
    committedEnd.current = false;
    setOffer(null);
    setWaitingAtEnd(false);
    setCompletionFailed(false);
    setCompleting(false);
  }, []);

  const commitEnd = useCallback(() => {
    if (committedEnd.current) return;
    committedEnd.current = true;
    const atRevision = revision.current;
    const finish = callback.current;
    setCompleting(true);
    setCompletionFailed(false);
    Promise.resolve().then(() => revision.current === atRevision ? finish() : true).then(ok => {
      if (revision.current === atRevision && !ok) setCompletionFailed(true);
    }, () => {
      if (revision.current === atRevision) setCompletionFailed(true);
    }).finally(() => { if (revision.current === atRevision) setCompleting(false); });
  }, []);

  const observe = useCallback(() => {
    const video = videoRef.current;
    if (!video || video.seeking || !Number.isFinite(video.currentTime)) return;
    if (document.visibilityState === 'hidden') return;
    if (video.ended) naturalEnd.current = true;
    const next = advanceRepeatOffer(state.current, {
      segments, mediaMs: Math.round(video.currentTime * 1000), nowMs: performance.now(),
      playing: !video.paused && !video.ended, ended: naturalEnd.current,
      enabled, playbackRate: video.playbackRate,
    });
    setOffer(previous => previous?.segmentIndex === next?.segmentIndex && previous?.shownAtMs === next?.shownAtMs ? previous : next);
    const pending = naturalEnd.current && !!state.current.pending;
    setWaitingAtEnd(pending);
    if (naturalEnd.current && !pending) commitEnd();
  }, [videoRef, segments, enabled, commitEnd]);

  // Reset on a new video, source/quality, rule set, or viewing mode. The
  // native element stays mounted during quality changes; stale offers do not.
  useEffect(() => {
    resetRepeatOffers(state.current);
    revision.current++;
    naturalEnd.current = false;
    committedEnd.current = false;
    const frame = requestAnimationFrame(() => { setOffer(null); setWaitingAtEnd(false); setCompletionFailed(false); setCompleting(false); });
    return () => cancelAnimationFrame(frame);
  }, [mediaKey, segments, enabled]);

  useEffect(() => () => { revision.current++; }, []);

  useEffect(() => {
    const timer = window.setInterval(observe, 100);
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        resetRepeatOffers(state.current);
        setOffer(null);
        setWaitingAtEnd(false);
      } else observe();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', onVisibility); };
  }, [observe]);

  const onPause = useCallback(() => {
    const video = videoRef.current;
    if (!video?.paused) return;
    if (video.ended) observe();
    else if (!committedEnd.current) clear();
  }, [videoRef, observe, clear]);
  const onPlay = useCallback(() => {
    if (!videoRef.current || videoRef.current.paused || videoRef.current.ended) return;
    if (naturalEnd.current) clear();
    observe();
  }, [videoRef, clear, observe]);
  const dismiss = useCallback(() => {
    resetRepeatOffers(state.current);
    setOffer(null);
    setWaitingAtEnd(false);
    if (naturalEnd.current && !committedEnd.current) {
      commitEnd();
    }
  }, [commitEnd]);

  const finishNearEnd = useCallback(() => {
    naturalEnd.current = true;
    commitEnd();
  }, [commitEnd]);
  const retryCompletion = useCallback(() => {
    committedEnd.current = false;
    commitEnd();
  }, [commitEnd]);
  const acceptRepeat = useCallback((): number | null => {
    const pending = state.current.pending;
    if (committedEnd.current || !pending || pending.shownAtMs === null
      || performance.now() >= pending.shownAtMs + pending.durationMs) return null;
    const target = pending.seekToMs;
    clear();
    return target;
  }, [clear]);

  return { offer, waitingAtEnd, completing, completionFailed, retryCompletion, acceptRepeat, finishNearEnd, observe, onPlay, onPause, onSeek: clear, onBuffering: clear, onEnded: observe, dismiss };
}
