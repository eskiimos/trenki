import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createEquipmentDetector, createMainEquipmentDetector, createWorkerEquipmentDetector } from '@/components/admin/pose/equipment-detector';
import { DEFAULT_EQUIPMENT_SETTINGS, type EquipmentDetection } from '@/lib/pose/equipment-tracker';

class FakeWorker {
  static instances: FakeWorker[] = [];
  static ready = true;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: ((event: { preventDefault: () => void }) => void) | null = null;
  onmessageerror: (() => void) | null = null;
  terminate = vi.fn();
  postMessage = vi.fn((message: { type: string }) => {
    if (message.type === 'init' && FakeWorker.ready) queueMicrotask(() => this.emit({ type: 'ready' }));
  });
  constructor() { FakeWorker.instances.push(this); }
  emit(data: unknown) { this.onmessage?.({ data }); }
}

const frame = () => ({ width: 4, height: 4, data: new Uint8ClampedArray(4 * 4 * 4) });
const result = { timestampMs: 100, targets: {}, stick: null } as EquipmentDetection;

beforeEach(() => {
  FakeWorker.instances = [];
  FakeWorker.ready = true;
  vi.stubGlobal('Worker', FakeWorker);
});
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('equipment detector transport', () => {
  it('transfers one owned RGBA buffer and drops concurrent work instead of accumulating frames', async () => {
    const detector = await createWorkerEquipmentDetector(new AbortController().signal);
    const worker = FakeWorker.instances[0];
    const image = frame();
    const pending = detector.detect(image, 100, DEFAULT_EQUIPMENT_SETTINGS);
    await expect(detector.detect(frame(), 101, DEFAULT_EQUIPMENT_SETTINGS)).rejects.toThrow('already in progress');
    expect(worker.postMessage).toHaveBeenLastCalledWith({
      type: 'frame', id: 1, width: 4, height: 4,
      buffer: image.data.buffer, timestampMs: 100, settings: DEFAULT_EQUIPMENT_SETTINGS,
    }, [image.data.buffer]);
    worker.emit({ type: 'result', id: 1, result });
    expect(await pending).toEqual(result);
    detector.close();
    detector.close();
    expect(worker.terminate).toHaveBeenCalledOnce();
  });

  it('copies pixel subarrays before transfer so unrelated bytes and byte offsets are excluded', async () => {
    const detector = await createWorkerEquipmentDetector(new AbortController().signal);
    const buffer = new Uint8ClampedArray(80);
    buffer.fill(122, 8, 72);
    const pending = detector.detect({ width: 4, height: 4, data: buffer.subarray(8, 72) }, 100, DEFAULT_EQUIPMENT_SETTINGS);
    const message = FakeWorker.instances[0].postMessage.mock.calls.at(-1)![0] as unknown as { buffer: ArrayBuffer };
    expect(message.buffer).not.toBe(buffer.buffer);
    expect(new Uint8Array(message.buffer)).toEqual(new Uint8Array(64).fill(122));
    FakeWorker.instances[0].emit({ type: 'result', id: 1, result });
    await pending;
    detector.close();
  });

  it('reset rejects old work and ignores its late response while a new configuration is in flight', async () => {
    const detector = await createWorkerEquipmentDetector(new AbortController().signal);
    const worker = FakeWorker.instances[0];
    const previous = detector.detect(frame(), 100, DEFAULT_EQUIPMENT_SETTINGS);
    const rejected = expect(previous).rejects.toMatchObject({ name: 'AbortError' });
    detector.reset();
    await rejected;
    expect(worker.postMessage).toHaveBeenLastCalledWith({ type: 'reset' });
    const next = detector.detect(frame(), 200, DEFAULT_EQUIPMENT_SETTINGS);
    let settled = false;
    void next.then(() => { settled = true; });
    worker.emit({ type: 'result', id: 1, result });
    worker.emit({ type: 'error', id: 1 });
    worker.emit({ type: 'result', id: 999, result });
    await Promise.resolve();
    expect(settled).toBe(false);
    const updated = { ...result, timestampMs: 200 };
    worker.emit({ type: 'result', id: 2, result: updated });
    expect(await next).toEqual(updated);
    detector.close();
  });

  it('camera stop terminates the worker and rejects pending detection immediately', async () => {
    const controller = new AbortController();
    const detector = await createWorkerEquipmentDetector(controller.signal);
    const pending = detector.detect(frame(), 100, DEFAULT_EQUIPMENT_SETTINGS);
    const rejected = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    controller.abort();
    await rejected;
    expect(FakeWorker.instances[0].terminate).toHaveBeenCalledOnce();
    await expect(detector.detect(frame(), 101, DEFAULT_EQUIPMENT_SETTINGS)).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('falls back without needing OffscreenCanvas or createImageBitmap support', async () => {
    vi.stubGlobal('Worker', undefined);
    const detector = await createEquipmentDetector(new AbortController().signal);
    expect(detector.execution).toBe('main');
    const detection = await detector.detect(frame(), 100, DEFAULT_EQUIPMENT_SETTINGS);
    expect(detection.timestampMs).toBe(100);
    expect(detection.targets.ball.status).toBe('lost');
    detector.close();
  });

  it('falls back and terminates failed worker initialization', async () => {
    FakeWorker.ready = false;
    const pending = createEquipmentDetector(new AbortController().signal);
    FakeWorker.instances[0].onerror?.({ preventDefault: vi.fn() });
    const detector = await pending;
    expect(detector.execution).toBe('main');
    expect(FakeWorker.instances[0].terminate).toHaveBeenCalledOnce();
    detector.close();
  });

  it('bounds worker startup and frame processing time', async () => {
    vi.useFakeTimers();
    FakeWorker.ready = false;
    const startup = createEquipmentDetector(new AbortController().signal);
    await vi.advanceTimersByTimeAsync(2000);
    const fallback = await startup;
    expect(fallback.execution).toBe('main');
    fallback.close();
    expect(FakeWorker.instances[0].terminate).toHaveBeenCalledOnce();
    FakeWorker.ready = true;
    const initialized = createWorkerEquipmentDetector(new AbortController().signal);
    await vi.advanceTimersByTimeAsync(0);
    const detector = await initialized;
    const pending = detector.detect(frame(), 100, DEFAULT_EQUIPMENT_SETTINGS);
    const rejected = expect(pending).rejects.toThrow('timeout');
    await vi.advanceTimersByTimeAsync(1500);
    await rejected;
    detector.close();
  });

  it('does not fall back and restart work after camera cancellation during startup', async () => {
    FakeWorker.ready = false;
    const controller = new AbortController();
    const pending = createEquipmentDetector(controller.signal);
    const rejected = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    controller.abort();
    await rejected;
    expect(FakeWorker.instances[0].terminate).toHaveBeenCalledOnce();
    expect(FakeWorker.instances).toHaveLength(1);
  });

  it('propagates runtime and decode errors so the caller can replace the worker', async () => {
    const detector = await createWorkerEquipmentDetector(new AbortController().signal);
    const pending = detector.detect(frame(), 100, DEFAULT_EQUIPMENT_SETTINGS);
    const rejected = expect(pending).rejects.toThrow('message failed');
    FakeWorker.instances[0].onmessageerror?.();
    await rejected;
    detector.close();
  });

  it('main fallback cannot consume another frame after stop or an already aborted signal', async () => {
    const controller = new AbortController();
    const detector = createMainEquipmentDetector(controller.signal);
    controller.abort();
    await expect(detector.detect(frame(), 100, DEFAULT_EQUIPMENT_SETTINGS)).rejects.toMatchObject({ name: 'AbortError' });
    expect(() => createMainEquipmentDetector(controller.signal)).toThrow('stopped');
  });
});
