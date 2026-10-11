'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createAudioCueState, nextAudioDecision, type AudioSnapshot } from '@/lib/pose/audio-cues';
import { AssessmentAudioPlayer } from './assessment-audio';

export function useAssessmentAudio() {
  const [enabled, setEnabled] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const enabledRef = useRef(false);
  const playerRef = useRef<AssessmentAudioPlayer | null>(null);
  const stateRef = useRef(createAudioCueState());
  const latestRef = useRef<AudioSnapshot | null>(null);
  const unlock = useCallback(() => {
    if (enabledRef.current) playerRef.current?.unlock();
  }, []);
  const test = useCallback(() => {
    setNotice(null);
    playerRef.current?.unlock();
    playerRef.current?.play({ text: 'Звук включён. Отсчёт и подсказки будут слышны во время тренировки.', tone: 'start' });
  }, []);
  const toggle = useCallback(() => {
    const next = !enabledRef.current;
    enabledRef.current = next; setEnabled(next); setNotice(null);
    stateRef.current = createAudioCueState();
    if (next) {
      // Enabling halfway through a workout must not announce a new start.
      if (latestRef.current) nextAudioDecision(stateRef.current, latestRef.current, performance.now());
      playerRef.current = new AssessmentAudioPlayer(setNotice);
      test();
    } else { playerRef.current?.dispose(); playerRef.current = null; }
  }, [test]);
  const observe = useCallback((snapshot: AudioSnapshot) => {
    latestRef.current = snapshot;
    if (!enabledRef.current || document.hidden) return;
    const decision = nextAudioDecision(stateRef.current, snapshot, performance.now());
    if (decision.stop) playerRef.current?.stop();
    if (decision.cue) playerRef.current?.play(decision.cue);
  }, []);
  const silence = useCallback(() => { playerRef.current?.stop(); stateRef.current = createAudioCueState(); }, []);
  useEffect(() => {
    const hide = () => { if (document.hidden) silence(); };
    document.addEventListener('visibilitychange', hide);
    return () => { document.removeEventListener('visibilitychange', hide); playerRef.current?.dispose(); playerRef.current = null; };
  }, [silence]);
  return { enabled, notice, toggle, test, unlock, observe, silence };
}
