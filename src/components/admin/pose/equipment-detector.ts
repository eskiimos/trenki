import {
  EquipmentTracker,
  type EquipmentDetection,
  type EquipmentImage,
  type EquipmentSettings,
} from '@/lib/pose/equipment-tracker';

export interface EquipmentDetector {
  execution: 'worker' | 'main';
  detect(image: EquipmentImage, timestampMs: number, settings: EquipmentSettings): Promise<EquipmentDetection>;
  reset(): void;
  close(): void;
}

const stopped = () => new DOMException('Equipment tracking stopped', 'AbortError');

export function createMainEquipmentDetector(signal: AbortSignal): EquipmentDetector {
  if (signal.aborted) throw stopped();
  const tracker = new EquipmentTracker();
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    tracker.reset();
    signal.removeEventListener('abort', close);
  };
  signal.addEventListener('abort', close, { once: true });
  return {
    execution: 'main',
    async detect(image, timestampMs, settings) {
      if (closed || signal.aborted) throw stopped();
      return tracker.detect(image, timestampMs, settings);
    },
    reset: () => tracker.reset(),
    close,
  };
}

/** Transfers only a small RGBA buffer. There is never a queue of camera frames. */
export async function createWorkerEquipmentDetector(signal: AbortSignal): Promise<EquipmentDetector> {
  if (signal.aborted) throw stopped();
  const worker = new Worker(new URL('./equipment.worker.ts', import.meta.url));
  let closed = false;
  let sequence = 0;
  let pending: {
    id: number;
    resolve: (value: EquipmentDetection) => void;
    reject: (error: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  } | null = null;
  let rejectReady: (error: Error) => void = () => {};
  const rejectFrame = (error: Error) => {
    if (!pending) return;
    clearTimeout(pending.timer);
    const reject = pending.reject;
    pending = null;
    reject(error);
  };
  const fail = (error: Error) => { rejectReady(error); rejectFrame(error); };
  const close = () => {
    if (closed) return;
    closed = true;
    worker.terminate();
    signal.removeEventListener('abort', close);
    fail(stopped());
  };
  signal.addEventListener('abort', close, { once: true });
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Equipment worker initialization timeout')), 2000);
      rejectReady = error => { clearTimeout(timer); reject(error); };
      worker.onerror = event => { event.preventDefault(); fail(new Error('Equipment worker failed')); };
      worker.onmessageerror = () => fail(new Error('Equipment worker message failed'));
      worker.onmessage = ({ data }) => {
        if (closed) return;
        if (data?.type === 'ready') { clearTimeout(timer); resolve(); }
        else if (data?.type === 'error' && (data.id === undefined || (pending && pending.id === data.id))) {
          fail(new Error('Equipment worker detection failed'));
        }
        else if (data?.type === 'result' && pending && pending.id === data.id) {
          clearTimeout(pending.timer);
          const resolveFrame = pending.resolve;
          pending = null;
          resolveFrame(data.result);
        }
      };
      worker.postMessage({ type: 'init' });
    });
    return {
      execution: 'worker',
      detect: async (image, timestampMs, settings) => {
        if (closed || signal.aborted) throw stopped();
        if (pending) throw new Error('Equipment detection already in progress');
        return new Promise<EquipmentDetection>((resolve, reject) => {
          const id = ++sequence;
          const timer = setTimeout(() => {
            if (pending?.id !== id) return;
            pending = null;
            reject(new Error('Equipment worker detection timeout'));
          }, 1500);
          pending = { id, timer, resolve, reject };
          try {
            // getImageData supplies an owned buffer. A view into a larger buffer is
            // copied so byte offsets never change the worker's pixel interpretation.
            const pixels = image.data.byteOffset === 0 && image.data.byteLength === image.data.buffer.byteLength
              ? image.data : new Uint8ClampedArray(image.data);
            worker.postMessage({
              type: 'frame', id, width: image.width, height: image.height,
              buffer: pixels.buffer, timestampMs, settings,
            }, [pixels.buffer as ArrayBuffer]);
          } catch (error) {
            clearTimeout(timer);
            pending = null;
            reject(error);
          }
        });
      },
      reset: () => {
        if (closed) return;
        rejectFrame(stopped());
        worker.postMessage({ type: 'reset' });
      },
      close,
    };
  } catch (error) {
    close();
    throw error;
  }
}

export async function createEquipmentDetector(signal: AbortSignal): Promise<EquipmentDetector> {
  if (typeof Worker !== 'undefined') {
    try { return await createWorkerEquipmentDetector(signal); }
    catch { if (signal.aborted) throw stopped(); }
  }
  return createMainEquipmentDetector(signal);
}
