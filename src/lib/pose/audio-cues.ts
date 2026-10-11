export type AudioPhase = 'ready' | 'preparing' | 'running' | 'paused' | 'finished';
export interface AudioSnapshot {
  phase: AudioPhase;
  playing: boolean;
  countdown: number | null;
  readinessMessage: string;
  buffering: boolean;
  interrupted: boolean;
  status?: string;
  guidance: string | null;
}
export interface AudioCue { text: string; tone: 'tick' | 'start' | 'notice' | 'finish'; count?: number }
export interface AudioCueState {
  phase: AudioPhase;
  condition: string;
  sinceMs: number;
  lastMs: number | null;
  lastHintMs: number;
  spoken: Record<string, number>;
  countdown: number | null;
}
export const createAudioCueState = (): AudioCueState => ({ phase: 'ready', condition: '', sinceMs: 0, lastMs: null, lastHintMs: -Infinity, spoken: {}, countdown: null });

/** No scheduled countdown: each tick requires a new, fresh readiness observation. */
export function nextAudioDecision(state: AudioCueState, input: AudioSnapshot, nowMs: number): { stop: boolean; cue: AudioCue | null } {
  if (!Number.isFinite(nowMs)) return { stop: true, cue: null };
  if (state.lastMs !== null && (nowMs < state.lastMs || nowMs - state.lastMs > 1500)) {
    Object.assign(state, createAudioCueState());
  }
  state.lastMs = nowMs;
  // Never announce a start while play() is pending/rejected or video is buffering.
  if (input.phase === 'running' && !input.playing && (!input.buffering || state.phase !== 'running')) return { stop: true, cue: null };
  if (state.phase !== input.phase) {
    const before = state.phase;
    state.phase = input.phase; state.condition = input.phase === 'preparing' ? `ready:${input.readinessMessage}` : ''; state.countdown = null; state.sinceMs = nowMs;
    state.lastHintMs = nowMs; state.spoken = {};
    const text = input.phase === 'preparing' ? 'Отойдите в кадр. Ждите отсчёта.'
      : input.phase === 'running' ? input.buffering ? null : 'Начинаем. Повторяйте за тренером.'
      : input.phase === 'paused' ? input.interrupted ? 'Пауза. Проверьте камеру и нажмите продолжить.' : 'Пауза.'
      : input.phase === 'finished' ? 'Тренировка завершена.'
      : before === 'preparing' ? input.interrupted ? 'Подготовка прервана. Проверьте камеру и снова нажмите подготовку.' : 'Подготовка отменена.' : null;
    return { stop: true, cue: text ? { text, tone: input.phase === 'running' ? 'start' : input.phase === 'finished' ? 'finish' : 'notice' } : null };
  }
  if (input.phase === 'preparing' && input.countdown !== null && input.countdown >= 1 && input.countdown <= 3) {
    const changed = state.countdown !== input.countdown;
    state.countdown = input.countdown; state.condition = ''; state.lastHintMs = nowMs;
    return { stop: changed, cue: changed ? { text: ['','Один','Два','Три'][input.countdown]!, tone: 'tick', count: input.countdown } : null };
  }
  const countdownLost = state.countdown !== null;
  state.countdown = null;
  const condition = input.phase === 'preparing' ? `ready:${input.readinessMessage}`
    : input.phase !== 'running' ? ''
    : input.buffering ? 'buffering'
    : input.status === 'no_camera_pose' ? 'missing'
    : input.status === 'insufficient_visibility' ? 'partial'
    : input.status === 'scored' && input.guidance ? `hint:${input.guidance}` : '';
  const previousCondition = state.condition;
  const changed = condition !== previousCondition;
  if (changed) { state.condition = condition; state.sinceMs = nowMs; }
  if (!condition) return { stop: changed || countdownLost, cue: null };
  const hint = condition.startsWith('hint:');
  const preparation = condition.startsWith('ready:');
  // A newly detected hint must not cut off the start/preparation announcement.
  const interrupt = countdownLost || (changed && ((!hint && !preparation) || state.spoken[previousCondition] !== undefined));
  const holdMs = hint ? 800 : preparation ? 600 : 1500;
  // One useful cue at a time; same instruction at most once per 20 seconds.
  const gapMs = hint ? 8000 : 3000;
  if (nowMs - state.sinceMs < holdMs || nowMs - state.lastHintMs < gapMs || nowMs - (state.spoken[condition] ?? -Infinity) < 20000) {
    return { stop: interrupt, cue: null };
  }
  state.lastHintMs = nowMs; state.spoken[condition] = nowMs;
  const text = hint ? input.guidance! : preparation ? input.readinessMessage
    : condition === 'missing' ? 'Камера не видит вас. Вернитесь в кадр.'
    : condition === 'partial' ? 'Часть тела не видна. Отойдите от камеры или измените ракурс.'
    : 'Видео загружается. Оценка на паузе.';
  return { stop: true, cue: { text, tone: 'notice' } };
}
