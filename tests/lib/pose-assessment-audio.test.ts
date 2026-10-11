import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AssessmentAudioPlayer } from '@/components/admin/pose/assessment-audio';

const contextState = { value: 'running' };
const oscillators: Array<{ start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn>; frequency: { value: number }; disconnect: ReturnType<typeof vi.fn> }> = [];
const close = vi.fn(async () => {}), resume = vi.fn(async () => {});
const synthesis = { getVoices: vi.fn(() => [{ lang: 'ru-RU', name: 'Russian' }]), resume: vi.fn(), speak: vi.fn(), cancel: vi.fn() };
class FakeContext {
  get state() { return contextState.value; }
  currentTime = 10;
  destination = {};
  close = close; resume = resume;
  createOscillator() {
    const node = { frequency: { value: 0 }, connect: vi.fn(), start: vi.fn(), stop: vi.fn(), disconnect: vi.fn(), onended: null };
    oscillators.push(node); return node;
  }
  createGain() { return { gain: { setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, connect: vi.fn(), disconnect: vi.fn() }; }
}
class FakeUtterance { lang = ''; rate = 1; volume = 1; voice: unknown; onend?: () => void; onerror?: (event: { error: string }) => void; constructor(public text: string) {} }
beforeEach(() => {
  vi.clearAllMocks(); oscillators.length = 0; contextState.value = 'running';
  synthesis.getVoices.mockReturnValue([{ lang: 'ru-RU', name: 'Russian' }]);
  resume.mockImplementation(async () => { contextState.value = 'running'; });
  vi.stubGlobal('window', { AudioContext: FakeContext, speechSynthesis: synthesis });
  vi.stubGlobal('document', { hidden: false }); vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance);
});
afterEach(() => vi.unstubAllGlobals());
describe('browser assessment audio output', () => {
  it('uses short Web Audio tones and explicitly selects a Russian voice', () => {
    const player = new AssessmentAudioPlayer(vi.fn()); player.unlock();
    player.play({ text: 'Начинаем.', tone: 'start' });
    expect(oscillators.map(n => n.frequency.value)).toEqual([660, 880]);
    expect(oscillators[0]?.start).toHaveBeenCalledWith(10);
    expect(synthesis.speak.mock.calls[0]?.[0]).toMatchObject({ text: 'Начинаем.', lang: 'ru-RU', voice: { lang: 'ru-RU' } });
    player.dispose(); expect(close).toHaveBeenCalledOnce();
  });
  it('replaces the current utterance instead of building a speech queue', () => {
    const notice = vi.fn(), player = new AssessmentAudioPlayer(notice); player.unlock();
    player.play({ text: 'Сверьтесь с тренером: корпус.', tone: 'notice' });
    const previous = synthesis.speak.mock.calls[0]?.[0] as unknown as FakeUtterance;
    player.play({ text: 'Пауза.', tone: 'notice' });
    expect(synthesis.cancel).toHaveBeenCalledOnce();
    // A canceled old callback must not disable the next voice.
    previous.onerror?.({ error: 'synthesis-failed' });
    player.play({ text: 'Продолжаем.', tone: 'start' });
    expect(synthesis.speak).toHaveBeenCalledTimes(3); expect(notice).not.toHaveBeenCalled(); player.dispose();
  });
  it('keeps tones when no Russian voice is installed and reports the limitation', () => {
    synthesis.getVoices.mockReturnValue([{ lang: 'en-US', name: 'English' }]);
    const notice = vi.fn(), player = new AssessmentAudioPlayer(notice); player.unlock(); player.play({ text: 'Три', tone: 'tick' });
    expect(oscillators).toHaveLength(1); expect(synthesis.speak).not.toHaveBeenCalled();
    expect(notice).toHaveBeenCalledWith(expect.stringContaining('Русский голос недоступен')); player.dispose();
  });
  it('recovers speech on an explicit tap after a failed utterance', () => {
    const notice = vi.fn(), player = new AssessmentAudioPlayer(notice); player.unlock(); player.play({ text: 'Три', tone: 'tick' });
    (synthesis.speak.mock.calls[0]?.[0] as unknown as FakeUtterance).onerror?.({ error: 'synthesis-failed' });
    player.play({ text: 'Два', tone: 'tick' }); expect(synthesis.speak).toHaveBeenCalledTimes(1);
    player.unlock(); player.play({ text: 'Проверка', tone: 'start' }); expect(synthesis.speak).toHaveBeenCalledTimes(2); player.dispose();
  });
  it('does not play stale tones when stop races a suspended context resume', async () => {
    contextState.value = 'suspended'; let ready!: () => void;
    resume.mockImplementation(() => new Promise<void>(resolve => { ready = () => { contextState.value = 'running'; resolve(); }; }));
    const player = new AssessmentAudioPlayer(vi.fn()); player.unlock(); player.play({ text: 'Три', tone: 'tick' });
    player.stop(); ready(); await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    expect(oscillators).toHaveLength(0); player.dispose();
  });
  it('stops active tones on disable and stays silent while hidden or after disposal', () => {
    const player = new AssessmentAudioPlayer(vi.fn()); player.unlock(); player.play({ text: 'Три', tone: 'tick' });
    player.stop(); expect(oscillators[0]?.stop).toHaveBeenCalledTimes(2);
    vi.stubGlobal('document', { hidden: true }); player.play({ text: 'Два', tone: 'tick' }); expect(oscillators).toHaveLength(1);
    player.dispose(); vi.stubGlobal('document', { hidden: false }); player.unlock(); player.play({ text: 'Один', tone: 'tick' });
    expect(oscillators).toHaveLength(1); expect(close).toHaveBeenCalledOnce();
  });
  it('does not throw in browsers without audio or speech APIs', () => {
    vi.stubGlobal('window', {}); vi.stubGlobal('SpeechSynthesisUtterance', undefined);
    const notice = vi.fn(), player = new AssessmentAudioPlayer(notice);
    expect(() => { player.unlock(); player.play({ text: 'Проверка', tone: 'start' }); player.dispose(); }).not.toThrow(); expect(notice).toHaveBeenCalled();
  });
});
