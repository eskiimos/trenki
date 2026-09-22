// Эталон движений тренера (пилот трекинга, п.1 «Середина сентября»): формат
// кадров, проверка того, что прислал браузер админа, углы суставов и сводка.
// Чистая логика без БД — используется и на клиенте (обработка, просмотр), и на
// сервере (проверка загрузки). Тесты — tests/lib/pose-reference.test.ts.
//
// Кадр — массив целых чисел:
//   [t_ms]                                   — тренер не найден
//   [t_ms, x,y,v ×33, wx,wy,wz ×33]          — 1 + 99 + 99 = 199 чисел
// x,y — координаты на кадре ×1000 (0…1000), v — видимость ×100 (0…100),
// wx,wy,wz — 3D-координаты в миллиметрах от центра таза (MediaPipe world
// landmarks; y направлена вниз). Целые числа — чтобы JSON был компактным.

export const POSE_REFERENCE_FORMAT = 1;
export const LANDMARKS = 33;
export const FRAME_LEN = 1 + LANDMARKS * 3 + LANDMARKS * 3;
/** Частота выборки при обработке: 10 кадров в секунду хватает для упражнений. */
export const REFERENCE_FPS = 10;
/**
 * Предохранители загрузки: до 40 минут видео при 10 fps. Эталон на 45 секунд —
 * ~130 КБ gzip / ~370 КБ JSON, то есть 40 минут — порядка 20 МБ JSON; разбор
 * заметно крупнее на сервере с 2 ГБ памяти опасен.
 */
export const MAX_REFERENCE_FRAMES = 40 * 60 * 10;
export const MAX_REFERENCE_GZIP_BYTES = 15 * 1024 * 1024;
export const MAX_REFERENCE_JSON_BYTES = 60 * 1024 * 1024;

export const POSE_MODELS = ['pose_landmarker_heavy', 'pose_landmarker_full', 'pose_landmarker_lite'] as const;
export type PoseModelName = (typeof POSE_MODELS)[number];

export interface PoseReferenceDoc {
  v: number;
  model: PoseModelName;
  fps: number;
  durationMs: number;
  width: number;
  height: number;
  frames: number[][];
}

/** Точка MediaPipe: нормализованные x,y (+ z) и видимость 0…1. */
export interface Landmark {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
}

// Индексы точек MediaPipe Pose
export const LM = {
  nose: 0,
  lShoulder: 11,
  rShoulder: 12,
  lElbow: 13,
  rElbow: 14,
  lWrist: 15,
  rWrist: 16,
  lHip: 23,
  rHip: 24,
  lKnee: 25,
  rKnee: 26,
  lAnkle: 27,
  rAnkle: 28,
} as const;

/** Линии скелета для отрисовки (подмножество POSE_CONNECTIONS без лица и кистей). */
export const SKELETON_EDGES: Array<[number, number]> = [
  [11, 12],
  [11, 13],
  [13, 15],
  [12, 14],
  [14, 16],
  [11, 23],
  [12, 24],
  [23, 24],
  [23, 25],
  [25, 27],
  [27, 29],
  [29, 31],
  [27, 31],
  [24, 26],
  [26, 28],
  [28, 30],
  [30, 32],
  [28, 32],
];

const clampInt = (v: number, min: number, max: number) => Math.max(min, Math.min(max, Math.round(v)));

/** Кадр из результата MediaPipe (2D + world). Нет позы — только время. */
export function encodeFrame(tMs: number, landmarks?: Landmark[] | null, world?: Landmark[] | null): number[] {
  const t = Math.max(0, Math.round(tMs));
  if (!landmarks || landmarks.length < LANDMARKS || !world || world.length < LANDMARKS) return [t];
  const out: number[] = [t];
  for (let i = 0; i < LANDMARKS; i++) {
    const p = landmarks[i]!;
    out.push(clampInt(p.x * 1000, -500, 1500), clampInt(p.y * 1000, -500, 1500), clampInt((p.visibility ?? 0) * 100, 0, 100));
  }
  for (let i = 0; i < LANDMARKS; i++) {
    const p = world[i]!;
    out.push(clampInt(p.x * 1000, -3000, 3000), clampInt(p.y * 1000, -3000, 3000), clampInt((p.z ?? 0) * 1000, -3000, 3000));
  }
  return out;
}

export const hasPose = (frame: number[]): boolean => frame.length === FRAME_LEN;

/** 2D-точка i кадра: x,y в долях кадра (0…1), видимость 0…1. */
export function point2d(frame: number[], i: number): { x: number; y: number; v: number } {
  const o = 1 + i * 3;
  return { x: frame[o]! / 1000, y: frame[o + 1]! / 1000, v: frame[o + 2]! / 100 };
}

/** 3D-точка i кадра в метрах (world). */
export function point3d(frame: number[], i: number): { x: number; y: number; z: number } {
  const o = 1 + LANDMARKS * 3 + i * 3;
  return { x: frame[o]! / 1000, y: frame[o + 1]! / 1000, z: frame[o + 2]! / 1000 };
}

const visible = (frame: number[], ids: number[], min = 0.5) => ids.every((i) => point2d(frame, i).v >= min);

/** Угол в точке b между отрезками b→a и b→c, градусы (0…180). */
export function jointAngle(
  a: { x: number; y: number; z: number },
  b: { x: number; y: number; z: number },
  c: { x: number; y: number; z: number },
): number {
  const u = { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
  const w = { x: c.x - b.x, y: c.y - b.y, z: c.z - b.z };
  const nu = Math.hypot(u.x, u.y, u.z);
  const nw = Math.hypot(w.x, w.y, w.z);
  if (nu === 0 || nw === 0) return NaN;
  const cos = (u.x * w.x + u.y * w.y + u.z * w.z) / (nu * nw);
  return (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI;
}

export type AngleKey = 'kneeL' | 'kneeR' | 'hipL' | 'hipR' | 'elbowL' | 'elbowR' | 'trunk';

export const ANGLE_LABELS: Record<AngleKey, string> = {
  kneeL: 'Колено Л',
  kneeR: 'Колено П',
  hipL: 'Таз Л',
  hipR: 'Таз П',
  elbowL: 'Локоть Л',
  elbowR: 'Локоть П',
  trunk: 'Наклон корпуса',
};

const ANGLE_POINTS: Record<Exclude<AngleKey, 'trunk'>, [number, number, number]> = {
  kneeL: [LM.lHip, LM.lKnee, LM.lAnkle],
  kneeR: [LM.rHip, LM.rKnee, LM.rAnkle],
  hipL: [LM.lShoulder, LM.lHip, LM.lKnee],
  hipR: [LM.rShoulder, LM.rHip, LM.rKnee],
  elbowL: [LM.lShoulder, LM.lElbow, LM.lWrist],
  elbowR: [LM.rShoulder, LM.rElbow, LM.rWrist],
};

/**
 * Углы суставов кадра по 3D-точкам (от ракурса почти не зависят). null — если
 * тренер не найден или нужные точки плохо видны (иначе угол — выдумка модели).
 * trunk — наклон линии «таз → плечи» от вертикали: 0° — стоит прямо.
 */
export function frameAngles(frame: number[]): Record<AngleKey, number | null> {
  const out = {} as Record<AngleKey, number | null>;
  const ok = hasPose(frame);
  for (const key of Object.keys(ANGLE_POINTS) as Array<Exclude<AngleKey, 'trunk'>>) {
    const [a, b, c] = ANGLE_POINTS[key];
    if (!ok || !visible(frame, [a, b, c])) {
      out[key] = null;
      continue;
    }
    const ang = jointAngle(point3d(frame, a), point3d(frame, b), point3d(frame, c));
    out[key] = Number.isFinite(ang) ? Math.round(ang) : null;
  }
  if (ok && visible(frame, [LM.lShoulder, LM.rShoulder, LM.lHip, LM.rHip])) {
    const ls = point3d(frame, LM.lShoulder);
    const rs = point3d(frame, LM.rShoulder);
    const lh = point3d(frame, LM.lHip);
    const rh = point3d(frame, LM.rHip);
    const up = { x: (ls.x + rs.x) / 2 - (lh.x + rh.x) / 2, y: (ls.y + rs.y) / 2 - (lh.y + rh.y) / 2, z: (ls.z + rs.z) / 2 - (lh.z + rh.z) / 2 };
    // Вертикаль «вверх» в координатах MediaPipe — отрицательная y
    const ang = jointAngle({ x: up.x, y: up.y, z: up.z }, { x: 0, y: 0, z: 0 }, { x: 0, y: -1, z: 0 });
    out.trunk = Number.isFinite(ang) ? Math.round(ang) : null;
  } else {
    out.trunk = null;
  }
  return out;
}

/** Кадр, ближайший к моменту видео tMs (кадры отсортированы по времени). */
export function frameIndexAt(frames: number[][], tMs: number): number {
  if (frames.length === 0) return -1;
  let lo = 0;
  let hi = frames.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (frames[mid]![0]! < tMs) lo = mid + 1;
    else hi = mid;
  }
  if (lo > 0 && Math.abs(frames[lo - 1]![0]! - tMs) <= Math.abs(frames[lo]![0]! - tMs)) return lo - 1;
  return lo;
}

export interface ReferenceSummary {
  frameCount: number;
  durationSec: number;
  /** Доля кадров, где тренер найден. */
  detectedRatio: number;
  /** Доля кадров, где видны таз, колени и голеностопы — пригодно для углов ног. */
  legsVisibleRatio: number;
}

const LEG_POINTS = [LM.lHip, LM.rHip, LM.lKnee, LM.rKnee, LM.lAnkle, LM.rAnkle];

export function summarizeReference(doc: Pick<PoseReferenceDoc, 'frames' | 'durationMs'>): ReferenceSummary {
  const n = doc.frames.length;
  let detected = 0;
  let legs = 0;
  for (const f of doc.frames) {
    if (!hasPose(f)) continue;
    detected++;
    if (visible(f, LEG_POINTS)) legs++;
  }
  const r = (x: number) => (n ? Math.round((x / n) * 1000) / 1000 : 0);
  return { frameCount: n, durationSec: Math.round(doc.durationMs / 100) / 10, detectedRatio: r(detected), legsVisibleRatio: r(legs) };
}

/**
 * Проверка документа, пришедшего из браузера админа. Возвращает ошибку или
 * null. Кадры — только целые числа в допустимых границах, время не убывает.
 */
export function validateReferenceDoc(raw: unknown): string | null {
  if (!raw || typeof raw !== 'object') return 'Пустые данные';
  const d = raw as Record<string, unknown>;
  if (d.v !== POSE_REFERENCE_FORMAT) return 'Неизвестная версия формата';
  if (!(POSE_MODELS as readonly unknown[]).includes(d.model)) return 'Неизвестная модель';
  if (!Number.isInteger(d.fps) || (d.fps as number) < 1 || (d.fps as number) > 30) return 'fps — от 1 до 30';
  if (!Number.isInteger(d.durationMs) || (d.durationMs as number) <= 0) return 'Нет длительности видео';
  if (!Number.isInteger(d.width) || !Number.isInteger(d.height)) return 'Нет размера кадра';
  if (!Array.isArray(d.frames) || d.frames.length === 0) return 'Нет кадров';
  if (d.frames.length > MAX_REFERENCE_FRAMES) return 'Слишком много кадров';
  let prevT = -1;
  const maxT = (d.durationMs as number) + 2000;
  for (const f of d.frames as unknown[]) {
    if (!Array.isArray(f) || (f.length !== 1 && f.length !== FRAME_LEN)) return 'Неверный формат кадра';
    for (const x of f) if (!Number.isInteger(x) || Math.abs(x as number) > 1_000_000) return 'Неверные числа в кадре';
    const t = f[0] as number;
    if (t < prevT || t > maxT) return 'Время кадров должно идти по порядку';
    prevT = t;
  }
  return null;
}
