import { EquipmentTracker, type EquipmentSettings } from '@/lib/pose/equipment-tracker';

type Message = { type: 'init' } | { type: 'reset' } | {
  type: 'frame'; id: number; width: number; height: number;
  buffer: ArrayBuffer; timestampMs: number; settings: EquipmentSettings;
};

const tracker = new EquipmentTracker();
// Keep worker types local; the app also compiles with the DOM library.
const scope = self as unknown as {
  onmessage: ((event: { data: Message }) => void) | null;
  postMessage(message: unknown): void;
};
scope.onmessage = ({ data }) => {
  if (data.type === 'init') scope.postMessage({ type: 'ready' });
  else if (data.type === 'reset') tracker.reset();
  else {
    try {
      const result = tracker.detect({
        width: data.width, height: data.height, data: new Uint8ClampedArray(data.buffer),
      }, data.timestampMs, data.settings);
      scope.postMessage({ type: 'result', id: data.id, result });
    } catch {
      scope.postMessage({ type: 'error', id: data.id });
    }
  }
};
