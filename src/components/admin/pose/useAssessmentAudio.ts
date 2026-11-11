'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createAudioCueState, nextAudioDecision, type AudioSnapshot } from '@/lib/pose/audio-cues';
import { AssessmentAudioPlayer } from './assessment-audio';

export function useAssessmentAudio() {
  const [enabled, setEnabled] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const enabledRef = useRef(true);
  const playerRef = useRef<AssessmentAudioPlayer | null>(null);
  const stateRef = useRef(createAudioCueState());
  const latestRef = useRef<AudioSnapshot | null>(null);
  const unlock = useCallback(() => {
    if (!enabledRef.current) return;
    playerRef.current ??= new AssessmentAudioPlayer(setNotice);
    playerRef.current.unlock();
  }, []);
  const test = useCallback(() => {
    setNotice(null);
    unlock();
    playerRef.current?.play({ text: 'Звук включён. Отсчёт и подсказки будут слышны во время тренировки.', tone: 'start' });
  }, [unlock]);
  const toggle = useCallback(() => {
    const next = !enabledRef.current;
    enabledRef.current = next; setEnabled(next); setNotice(null);
    stateRef.current = createAudioCueState();
    if (next) {
      // Enabling halfway through a workout must not announce a new start.
      if (latestRef.current) nextAudioDecision(stateRef.current, latestRef.current, performance.now());
      test();
    } else { playerRef.current?.dispose(); playerRef.current = null; }
  }, [test]);
  const observe = useCallback((snapshot: AudioSnapshot, afterSpeech?: () => void) => {
    latestRef.current = snapshot;
    const player = playerRef.current;
    if (!enabledRef.current || !player || document.hidden) { afterSpeech?.(); return; }
    const decision = nextAudioDecision(stateRef.current, snapshot, performance.now());
    if (decision.cue) player.play(decision.cue, afterSpeech);
    else {
      if (decision.stop) player.stop();
      afterSpeech?.();
    }
  }, []);
  const silence = useCallback(() => { playerRef.current?.stop(); stateRef.current = createAudioCueState(); }, []);
  useEffect(() => {
    const hide = () => { if (document.hidden) silence(); };
    document.addEventListener('visibilitychange', hide);
    return () => { document.removeEventListener('visibilitychange', hide); playerRef.current?.dispose(); playerRef.current = null; };
  }, [silence]);
  return { enabled, notice, toggle, test, unlock, observe, silence };
}
