import { createLandmarker, type PoseResult } from './landmarker';
export interface CameraDetector {
  delegate: 'GPU' | 'CPU';
  execution: 'worker' | 'main';
  detect(video: HTMLVideoElement, timestampMs: number): Promise<PoseResult>;
  close(): void;
}
const aborted = () => new DOMException('Camera stopped', 'AbortError');
export async function createMainDetector(signal: AbortSignal): Promise<CameraDetector> {
  if (signal.aborted) throw aborted();
  const model = await createLandmarker('pose_landmarker_lite');
  if (signal.aborted) { model.close(); throw aborted(); }
  return { delegate: model.delegate, execution: 'main', detect: async (video, timestampMs) => model.detectForVideo(video, timestampMs), close: () => model.close() };
}
export function canUsePoseWorker(): boolean {
  return typeof Worker !== 'undefined' && typeof OffscreenCanvas !== 'undefined' && typeof createImageBitmap === 'function';
}
export async function createWorkerDetector(signal: AbortSignal): Promise<CameraDetector> {
  if (signal.aborted) throw aborted();
  const worker = new Worker('/mediapipe/0.10.14/pose-camera-worker.js');
  let closed = false, sequence = 0, inFlight = false;
  let pending: { id: number; resolve: (r: PoseResult) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> } | null = null;
  let readyReject: (e: Error) => void = () => {};
  const fail = (error: Error) => {
    readyReject(error);
    if (pending) { clearTimeout(pending.timer); pending.reject(error); pending = null; }
  };
  const close = () => {
    if (closed) return;
    closed = true; worker.terminate(); signal.removeEventListener('abort', close); fail(aborted());
  };
  signal.addEventListener('abort', close, { once: true });
  try {
    const delegate = await new Promise<'GPU' | 'CPU'>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Worker initialization timeout')), 30000);
      readyReject = e => { clearTimeout(timer); reject(e); };
      worker.onerror = event => { event.preventDefault(); fail(new Error('Worker failed')); };
      worker.onmessageerror = () => fail(new Error('Worker message failed'));
      worker.onmessage = ({ data }) => {
        if (closed) return;
        if (data.type === 'ready') { clearTimeout(timer); resolve(data.delegate); }
        else if (data.type === 'error') fail(new Error('Worker inference failed'));
        else if (data.type === 'result' && pending && pending.id === data.id) {
          clearTimeout(pending.timer); const resolveResult = pending.resolve; pending = null; resolveResult(data.result);
        }
      };
      worker.postMessage({ type: 'init' });
    });
    return {
      delegate, execution: 'worker', close,
      detect: async (video, timestampMs) => {
        if (closed || signal.aborted) throw aborted();
        if (inFlight) throw new Error('Inference already in progress');
        inFlight = true;
        try {
          const bitmap = await createImageBitmap(video);
          if (closed || signal.aborted) { bitmap.close(); throw aborted(); }
          return await new Promise<PoseResult>((resolve, reject) => {
            const id = ++sequence;
            const timer = setTimeout(() => { pending = null; reject(new Error('Inference timeout')); }, 3000);
            pending = { id, resolve, reject, timer };
            try { worker.postMessage({ type: 'frame', id, bitmap, timestampMs }, [bitmap]); }
            catch (error) { bitmap.close(); clearTimeout(timer); pending = null; reject(error); }
          });
        } finally { inFlight = false; }
      },
    };
  } catch (error) { close(); throw error; }
}
export async function createCameraDetector(signal: AbortSignal): Promise<CameraDetector> {
  if (canUsePoseWorker()) {
    try { return await createWorkerDetector(signal); }
    catch { if (signal.aborted) throw aborted(); }
  }
  return createMainDetector(signal);
}
