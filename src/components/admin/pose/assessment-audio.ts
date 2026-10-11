import type { AudioCue } from '@/lib/pose/audio-cues';

/** Browser output only. At most one utterance; no timer can start a later cue. */
export class AssessmentAudioPlayer {
  private context: AudioContext | null = null;
  private nodes = new Set<OscillatorNode>();
  private utterance: SpeechSynthesisUtterance | null = null;
  private disposed = false;
  private speechFailed = false;
  private revision = 0;
  private resuming: Promise<void> | null = null;
  constructor(private onUnavailable: (message: string) => void) {}

  // Called directly in a tap handler, before awaiting camera/model/video loading.
  unlock(): void {
    if (this.disposed) return;
    this.speechFailed = false;
    try {
      const Constructor = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!this.context && Constructor) this.context = new Constructor();
      if (this.context?.state === 'suspended' && !this.resuming) {
        this.resuming = this.context.resume().catch(() => {
          if (!this.disposed) this.onUnavailable('Звук заблокирован. Нажмите «Проверить звук» ещё раз.');
        }).finally(() => { this.resuming = null; });
      }
    } catch { this.onUnavailable('Не удалось включить звуковые сигналы.'); }
    if (!this.context && !('speechSynthesis' in window)) this.onUnavailable('Звук не поддерживается этим браузером. Подсказки остаются на экране.');
  }

  play(cue: AudioCue): void {
    if (this.disposed || document.hidden) return;
    this.stop();
    const revision = this.revision;
    // Short tones remain available if the device has no Russian speech voice.
    const patterns = cue.tone === 'tick' ? [660] : cue.tone === 'start' ? [660, 880] : cue.tone === 'finish' ? [880, 660] : [440, 440];
    const context = this.context;
    const tones = () => {
      if (!context || context.state !== 'running' || this.disposed || document.hidden || this.revision !== revision) return;
      try {
        patterns.forEach((frequency, i) => {
          const oscillator = context.createOscillator(), gain = context.createGain();
          const start = context.currentTime + i * 0.16;
          oscillator.frequency.value = frequency;
          gain.gain.setValueAtTime(0, start); gain.gain.linearRampToValueAtTime(0.12, start + 0.015);
          gain.gain.exponentialRampToValueAtTime(0.001, start + 0.12);
          oscillator.connect(gain); gain.connect(context.destination); this.nodes.add(oscillator);
          oscillator.onended = () => { this.nodes.delete(oscillator); oscillator.disconnect(); gain.disconnect(); };
          oscillator.start(start); oscillator.stop(start + 0.13);
        });
      } catch { this.onUnavailable('Не удалось воспроизвести сигнал. Проверьте громкость и нажмите «Проверить звук».'); }
    };
    if (context?.state === 'running') tones();
    else if (this.resuming) void this.resuming.then(tones);
    else if (context) this.onUnavailable('Звук приостановлен браузером. Нажмите «Проверить звук» перед продолжением.');
    if (this.speechFailed || !('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') {
      this.onUnavailable(context ? 'Голос недоступен. Ориентируйтесь на сигналы и текст на экране.' : 'Звук недоступен в этом браузере. Подсказки остаются на экране.');
      return;
    }
    try {
      const synthesis = window.speechSynthesis;
      const voices = synthesis.getVoices();
      const russian = voices.find(voice => /^ru(?:-|_|$)/i.test(voice.lang));
      if (voices.length && !russian) {
        this.onUnavailable(context ? 'Русский голос недоступен. Ориентируйтесь на сигналы и текст на экране.' : 'Русский голос недоступен. Подсказки остаются на экране.'); return;
      }
      const utterance = new SpeechSynthesisUtterance(cue.text);
      utterance.lang = 'ru-RU'; utterance.rate = 1.1; utterance.volume = 0.9;
      if (russian) utterance.voice = russian;
      this.utterance = utterance;
      utterance.onend = () => { if (this.utterance === utterance) this.utterance = null; };
      utterance.onerror = event => {
        if (revision !== this.revision || event.error === 'canceled' || event.error === 'interrupted') return;
        this.speechFailed = true; this.utterance = null;
        this.onUnavailable('Не удалось озвучить подсказку. Проверьте русский голос в настройках устройства; текст остаётся на экране.');
      };
      synthesis.resume(); synthesis.speak(utterance);
    } catch { this.speechFailed = true; this.onUnavailable('Голос недоступен. Используются звуковые сигналы.'); }
  }

  stop(): void {
    this.revision++;
    if (this.utterance) { this.utterance = null; window.speechSynthesis?.cancel(); }
    for (const node of this.nodes) { try { node.stop(); } catch { /* already ended */ } }
    this.nodes.clear();
  }
  dispose(): void {
    if (this.disposed) return;
    this.stop(); this.disposed = true;
    if (this.context) void this.context.close().catch(() => {});
    this.context = null;
  }
}
