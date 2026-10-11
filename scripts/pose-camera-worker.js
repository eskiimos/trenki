/* global importScripts, OffscreenCanvas */
// Classic worker: MediaPipe's pinned CJS bundle and Emscripten use importScripts.
// No camera, network upload or DOM access; ImageBitmaps are always closed.
self.exports = {};
let landmarker = null;
self.onmessage = async ({ data }) => {
  try {
    if (data.type === 'init') {
      importScripts('./vision_bundle.js');
      const { FilesetResolver, PoseLandmarker } = self.exports;
      const fileset = await FilesetResolver.forVisionTasks(new URL('./wasm', self.location.href).href);
      const make = delegate => PoseLandmarker.createFromOptions(fileset, {
        canvas: new OffscreenCanvas(1, 1),
        baseOptions: { modelAssetPath: new URL('../models/pose_landmarker_lite.task', self.location.href).href, delegate },
        runningMode: 'VIDEO', numPoses: 1,
        minPoseDetectionConfidence: 0.5, minPosePresenceConfidence: 0.5, minTrackingConfidence: 0.5,
      });
      let delegate = 'GPU';
      try { landmarker = await make(delegate); }
      catch { delegate = 'CPU'; landmarker = await make(delegate); }
      self.postMessage({ type: 'ready', delegate });
    } else if (data.type === 'frame') {
      try {
        if (!landmarker) throw new Error('Model not ready');
        const result = landmarker.detectForVideo(data.bitmap, data.timestampMs);
        self.postMessage({ type: 'result', id: data.id, result: { landmarks: result.landmarks, worldLandmarks: result.worldLandmarks } });
      } finally { data.bitmap.close(); }
    }
  } catch {
    self.postMessage({ type: 'error', id: data.id });
  }
};
