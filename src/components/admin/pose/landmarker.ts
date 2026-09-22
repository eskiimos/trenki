'use client';

// Загрузка MediaPipe Pose Landmarker (Google, Apache 2.0) для обработки эталона
// в браузере админа. Модель heavy — самая точная: скорость тут не важна, видео
// обрабатывается один раз. Код и WASM — с jsdelivr, модель — из Google Storage
// (оба хоста есть в CSP connect-src). Перед выдачей камеры атлетам файлы надо
// положить к себе — зависимость от чужих CDN для пользователей в РФ.

// Версия — та же, что в import ниже (там нужен строковый литерал)
const VISION_WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';
export const REFERENCE_MODEL = 'pose_landmarker_heavy' as const;
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/1/pose_landmarker_heavy.task';

export interface PoseResult {
  landmarks?: Array<Array<{ x: number; y: number; z: number; visibility?: number }>>;
  worldLandmarks?: Array<Array<{ x: number; y: number; z: number; visibility?: number }>>;
}

export interface Landmarker {
  detectForVideo(video: HTMLVideoElement, timestampMs: number): PoseResult;
  close(): void;
  delegate: 'GPU' | 'CPU';
}

export async function createLandmarker(): Promise<Landmarker> {
  // Строка-литерал + ignore-комментарии: бандлер не трогает CDN-модуль
  const vision = await import(
    /* webpackIgnore: true */ /* turbopackIgnore: true */
    // @ts-expect-error CDN URL — типов нет
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs'
  );
  const fileset = await vision.FilesetResolver.forVisionTasks(VISION_WASM);
  const make = (delegate: 'GPU' | 'CPU') =>
    vision.PoseLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MODEL_URL, delegate },
      runningMode: 'VIDEO',
      numPoses: 1,
      minPoseDetectionConfidence: 0.5,
      minPosePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });
  try {
    const lm = await make('GPU');
    return Object.assign(lm, { delegate: 'GPU' as const });
  } catch {
    // Нет WebGL / видеокарта не подошла — медленнее, но работает
    const lm = await make('CPU');
    return Object.assign(lm, { delegate: 'CPU' as const });
  }
}
