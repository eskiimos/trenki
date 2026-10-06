'use client';

import type { PoseModelName } from '@/lib/pose/reference';

// Загрузка MediaPipe Pose Landmarker (Google, Apache 2.0) для админки.
// Эталон обрабатывается моделью heavy, камера — lite ради скорости.
// Код собирается из закреплённого npm-пакета, WASM и lite-модель отдаёт наш
// сервер, как и heavy для ручной обработки эталонов.

const VISION_WASM = '/mediapipe/0.10.14/wasm';
export const REFERENCE_MODEL = 'pose_landmarker_heavy' as const;
const modelUrl = (model: PoseModelName) =>
  model !== 'pose_landmarker_full'
    ? `/mediapipe/models/${model}.task`
    : `https://storage.googleapis.com/mediapipe-models/pose_landmarker/${model}/float16/1/${model}.task`;

export interface PoseResult {
  landmarks?: Array<Array<{ x: number; y: number; z: number; visibility?: number }>>;
  worldLandmarks?: Array<Array<{ x: number; y: number; z: number; visibility?: number }>>;
}

export interface Landmarker {
  detectForVideo(video: HTMLVideoElement, timestampMs: number): PoseResult;
  close(): void;
  delegate: 'GPU' | 'CPU';
}

export async function createLandmarker(model: PoseModelName = REFERENCE_MODEL): Promise<Landmarker> {
  const vision = await import('@mediapipe/tasks-vision');
  const fileset = await vision.FilesetResolver.forVisionTasks(VISION_WASM);
  const make = (delegate: 'GPU' | 'CPU') =>
    vision.PoseLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: modelUrl(model), delegate },
      runningMode: 'VIDEO',
      numPoses: 1,
      minPoseDetectionConfidence: 0.5,
      minPosePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });
  try {
    const lm = await make('GPU');
    return {
      delegate: 'GPU',
      detectForVideo: (video, timestampMs) => lm.detectForVideo(video, timestampMs),
      close: () => lm.close(),
    };
  } catch {
    // Нет WebGL / видеокарта не подошла — медленнее, но работает
    const lm = await make('CPU');
    return {
      delegate: 'CPU',
      detectForVideo: (video, timestampMs) => lm.detectForVideo(video, timestampMs),
      close: () => lm.close(),
    };
  }
}
