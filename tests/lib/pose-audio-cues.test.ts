import { describe, expect, it } from 'vitest';
import { createAudioCueState, nextAudioDecision, type AudioSnapshot, type AudioCueState } from '@/lib/pose/audio-cues';

const input = (patch: Partial<AudioSnapshot> = {}): AudioSnapshot => ({ phase: 'running', playing: true, countdown: null,
  readinessMessage: 'Встаньте перед камерой.', buffering: false, interrupted: false, status: 'scored', guidance: null, ...patch });
function frames(state: AudioCueState, snapshot: AudioSnapshot, from: number, to: number) {
  return Array.from({ length: Math.floor((to - from) / 100) + 1 }, (_, i) => nextAudioDecision(state, snapshot, from + i * 100)).flatMap(d => d.cue ? [d.cue] : []);
}
describe('audible live assessment cues', () => {
  it('only counts fresh readiness seconds and never queues a later start', () => {
    const state = createAudioCueState();
    const prep = input({ phase: 'preparing', playing: false });
    expect(nextAudioDecision(state, prep, 0).cue?.text).toContain('Отойдите');
    expect(frames(state, { ...prep, countdown: 3 }, 100, 900).map(c => c.text)).toEqual(['Три']);
    expect(frames(state, { ...prep, countdown: 2 }, 1000, 1900).map(c => c.text)).toEqual(['Два']);
    expect(frames(state, { ...prep, countdown: 1 }, 2000, 2900).map(c => c.text)).toEqual(['Один']);
    expect(nextAudioDecision(state, input(), 3000).cue?.tone).toBe('start');
    expect(frames(state, input(), 3100, 5000)).toEqual([]);
  });
  it('cancels a countdown immediately when visibility is lost and ticks again after recovery', () => {
    const state = createAudioCueState(), prep = input({ phase: 'preparing', playing: false });
    nextAudioDecision(state, prep, 0); nextAudioDecision(state, { ...prep, countdown: 2 }, 100);
    expect(nextAudioDecision(state, prep, 200)).toEqual({ stop: true, cue: null });
    expect(nextAudioDecision(state, { ...prep, countdown: 3 }, 300).cue?.text).toBe('Три');
  });
  it('does not announce start for pending or rejected autoplay, including initial buffering', () => {
    const state = createAudioCueState();
    nextAudioDecision(state, input({ phase: 'preparing' }), 0);
    expect(nextAudioDecision(state, input({ playing: false }), 100).cue).toBeNull();
    expect(nextAudioDecision(state, input({ playing: false, buffering: true }), 200).cue).toBeNull();
    expect(nextAudioDecision(state, input({ phase: 'paused', playing: false }), 300).cue?.text).toBe('Пауза.');
    expect(nextAudioDecision(state, input(), 400).cue?.tone).toBe('start');
  });
  it('distinguishes canceled preparation from camera interruption and announces finish once', () => {
    for (const interrupted of [false, true]) {
      const state = createAudioCueState(); nextAudioDecision(state, input({ phase: 'preparing' }), 0);
      const cue = nextAudioDecision(state, input({ phase: 'ready', interrupted }), 100).cue;
      expect(cue?.text).toContain(interrupted ? 'Проверьте камеру' : 'отменена');
      expect(nextAudioDecision(state, input({ phase: 'finished' }), 200).cue?.tone).toBe('finish');
      expect(frames(state, input({ phase: 'finished' }), 300, 1000)).toEqual([]);
    }
  });
  it('ignores brief camera losses and announces sustained loss at a limited frequency', () => {
    const state = createAudioCueState(); nextAudioDecision(state, input(), 0);
    expect(frames(state, input({ status: 'no_camera_pose' }), 100, 1000)).toEqual([]);
    frames(state, input(), 1100, 1900);
    const cues = frames(state, input({ status: 'no_camera_pose' }), 2000, 24000);
    expect(cues).toHaveLength(2); expect(cues[0]?.text).toContain('Камера не видит');
  });
  it('waits for a persistent neutral hint and leaves at least eight seconds between different hints', () => {
    const state = createAudioCueState(); nextAudioDecision(state, input(), 0);
    const a = input({ guidance: 'Сверьтесь с тренером: правое колено.' });
    const b = input({ guidance: 'Сверьтесь с тренером: корпус.' });
    expect(frames(state, a, 100, 700)).toEqual([]);
    frames(state, input(), 800, 1900);
    expect(frames(state, a, 2000, 8000).map(c => c.text)).toEqual([a.guidance]);
    expect(frames(state, b, 8100, 15900)).toEqual([]);
    expect(nextAudioDecision(state, b, 16000).cue?.text).toBe(b.guidance);
  });
  it('repeats the same joint hint no more than once per twenty seconds', () => {
    const state = createAudioCueState(); nextAudioDecision(state, input(), 0);
    const cues = frames(state, input({ guidance: 'Сверьтесь с тренером: корпус.' }), 100, 29000);
    expect(cues).toHaveLength(2);
  });
  it('lets the start announcement finish while a new joint hint is still being debounced', () => {
    const state = createAudioCueState(); nextAudioDecision(state, input(), 0);
    expect(nextAudioDecision(state, input({ guidance: 'Сверьтесь с тренером: корпус.' }), 900)).toEqual({ stop: false, cue: null });
  });
  it('clears stale joint hints during rest, missing reference and recovered visibility', () => {
    for (const status of ['inactive', 'no_reference_pose', 'scored']) {
      const state = createAudioCueState(); nextAudioDecision(state, input(), 0);
      frames(state, input({ guidance: 'Сверьтесь с тренером: корпус.' }), 100, 8000);
      expect(nextAudioDecision(state, input({ status }), 8100)).toEqual({ stop: true, cue: null });
    }
  });
  it('announces sustained buffering but never speaks joint guidance while buffering', () => {
    const state = createAudioCueState(); nextAudioDecision(state, input(), 0);
    const cues = frames(state, input({ playing: false, buffering: true, guidance: 'Сверьтесь с тренером: корпус.' }), 100, 5000);
    expect(cues).toHaveLength(1); expect(cues[0]?.text).toContain('Видео загружается');
  });
  it('rejects invalid clocks and discards countdown history after a capture gap', () => {
    const state = createAudioCueState(); const prep = input({ phase: 'preparing', countdown: 1 });
    nextAudioDecision(state, prep, 0);
    expect(nextAudioDecision(state, prep, NaN)).toEqual({ stop: true, cue: null });
    expect(nextAudioDecision(state, { ...prep, countdown: null }, 5000).cue?.text).toContain('Ждите отсчёта');
    expect(state.countdown).toBeNull();
  });
});
