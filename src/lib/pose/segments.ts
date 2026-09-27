// Рабочие отрезки эталона: где тренер реально выполняет упражнение, а где
// объясняет технику, отдыхает или его вообще нет в кадре. В эталоне храним
// ТОЛЬКО рабочие отрезки — всё остальное при оценке не учитывается (правка
// владельца 27.09: «моменты с объяснением не учитывать в оценке»).
//
// Разметка считается автоматически при обработке видео и правится админом на
// таймлайне. Чистая логика без БД — тесты в tests/lib/pose-segments.test.ts.

import { frameAngles, hasPose, type AngleKey } from '@/lib/pose/reference';

export interface Segment {
  startMs: number;
  endMs: number;
}

/** Углы, по которым судим о движении: ноги, таз, руки, корпус. */
const MOTION_ANGLES: AngleKey[] = ['kneeL', 'kneeR', 'hipL', 'hipR', 'elbowL', 'elbowR', 'trunk'];

export const SEGMENT_DEFAULTS = {
  /** Градусов в секунду суммарно по суставам — ниже этого тренер «стоит и говорит». */
  motionThreshold: 25,
  /**
   * Насколько поза отличается от «стою прямо», градусов. Растяжка и удержания
   * (шпагат, планка, «стульчик») почти без движения, но тело в рабочем
   * положении — по одной скорости они терялись (на видео про шпагат
   * автоматика находила 0:40 работы из 8:48).
   */
  postureThreshold: 30,
  /** Окно сглаживания, мс: короткий взмах рукой во время объяснения не считается упражнением. */
  smoothMs: 1500,
  /** Отрезок короче — не упражнение. */
  minSegmentMs: 3000,
  /** Пауза внутри упражнения короче — не разрывает отрезок. */
  maxGapMs: 2000,
};

export const MAX_SEGMENTS = 200;

/**
 * По кадрам: скорость изменения углов (градусов в секунду) и «нерасслабленность»
 * позы — максимальное отклонение от стойки прямо (ноги 180°, корпус 0°).
 * Кадр без тренера — нули.
 */
export function motionSeries(frames: number[][]): { times: number[]; motion: number[]; posture: number[] } {
  const times = frames.map((f) => f[0]!);
  const motion = new Array<number>(frames.length).fill(0);
  const posture = new Array<number>(frames.length).fill(0);
  let prevAngles: Record<AngleKey, number | null> | null = null;
  let prevT = times[0] ?? 0;
  for (let i = 0; i < frames.length; i++) {
    const f = frames[i]!;
    const t = f[0]!;
    if (!hasPose(f)) {
      prevAngles = null;
      prevT = t;
      continue;
    }
    const a = frameAngles(f);
    posture[i] = Math.max(
      ...[a.kneeL, a.kneeR, a.hipL, a.hipR].map((x) => (x == null ? 0 : Math.max(0, 180 - x))),
      a.trunk == null ? 0 : Math.abs(a.trunk),
    );
    if (prevAngles) {
      const dtSec = Math.max(0.001, (t - prevT) / 1000);
      let sum = 0;
      for (const key of MOTION_ANGLES) {
        const x = a[key];
        const y = prevAngles[key];
        if (x != null && y != null) sum += Math.abs(x - y);
      }
      motion[i] = sum / dtSec;
    }
    prevAngles = a;
    prevT = t;
  }
  return { times, motion, posture };
}

/** Скользящее среднее по времени (окно ±smoothMs/2). */
function smooth(times: number[], values: number[], smoothMs: number): number[] {
  const out = new Array<number>(values.length).fill(0);
  let lo = 0;
  let hi = 0;
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    const from = times[i]! - smoothMs / 2;
    const to = times[i]! + smoothMs / 2;
    while (hi < values.length && times[hi]! <= to) sum += values[hi++]!;
    while (times[lo]! < from) sum -= values[lo++]!;
    out[i] = hi > lo ? sum / (hi - lo) : 0;
  }
  return out;
}

/**
 * Автоматическая разметка: рабочий отрезок — там, где тренер двигается или
 * стоит в рабочем положении (растяжка, планка, «стульчик»). Пороги подобраны
 * под 10 кадров в секунду. Объяснение стоя и паузы отсекаются; спорные куски
 * админ правит на таймлайне.
 */
export function detectSegments(
  frames: number[][],
  durationMs: number,
  opts: Partial<typeof SEGMENT_DEFAULTS> = {},
): Segment[] {
  const o = { ...SEGMENT_DEFAULTS, ...opts };
  if (frames.length === 0) return [];
  const { times, motion, posture } = motionSeries(frames);
  const level = smooth(times, motion, o.smoothMs);
  const pose = smooth(times, posture, o.smoothMs);

  // Работа = тренер двигается ИЛИ стоит в рабочем положении (растяжка, удержание)
  const raw: Segment[] = [];
  let start: number | null = null;
  for (let i = 0; i < level.length; i++) {
    const active = level[i]! >= o.motionThreshold || pose[i]! >= o.postureThreshold;
    if (active && start === null) start = times[i]!;
    if (!active && start !== null) {
      raw.push({ startMs: start, endMs: times[i]! });
      start = null;
    }
  }
  if (start !== null) raw.push({ startMs: start, endMs: Math.min(durationMs, times[times.length - 1]! + 100) });

  // Склеиваем короткие паузы, выбрасываем короткие куски
  const merged: Segment[] = [];
  for (const seg of raw) {
    const last = merged[merged.length - 1];
    if (last && seg.startMs - last.endMs <= o.maxGapMs) last.endMs = seg.endMs;
    else merged.push({ ...seg });
  }
  return normalizeSegments(
    merged.filter((s) => s.endMs - s.startMs >= o.minSegmentMs),
    durationMs,
  );
}

/** Сортировка, обрезка по длине видео, склейка пересечений. Пустые — выбрасываются. */
export function normalizeSegments(segments: Segment[], durationMs: number): Segment[] {
  const clean = segments
    .map((s) => ({
      startMs: Math.max(0, Math.round(Math.min(s.startMs, s.endMs))),
      endMs: Math.min(durationMs, Math.round(Math.max(s.startMs, s.endMs))),
    }))
    .filter((s) => s.endMs > s.startMs)
    .sort((a, b) => a.startMs - b.startMs);
  const out: Segment[] = [];
  for (const s of clean) {
    const last = out[out.length - 1];
    if (last && s.startMs <= last.endMs) last.endMs = Math.max(last.endMs, s.endMs);
    else out.push(s);
  }
  return out;
}

/** Чистое время упражнений, мс. */
export function activeMs(segments: Segment[]): number {
  return segments.reduce((sum, s) => sum + (s.endMs - s.startMs), 0);
}

/** Попадает ли момент видео в рабочий отрезок (по этому правилу оценивается выполнение). */
export function isActiveAt(segments: Segment[], ms: number): boolean {
  return segments.some((s) => ms >= s.startMs && ms < s.endMs);
}

/** Разметка из БД/запроса: что угодно → валидный список или ошибка. */
export function parseSegments(raw: unknown, durationMs: number): Segment[] | null {
  if (!Array.isArray(raw)) return null;
  const out: Segment[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') return null;
    const { startMs, endMs } = item as Record<string, unknown>;
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return null;
    out.push({ startMs: Number(startMs), endMs: Number(endMs) });
  }
  if (out.length > MAX_SEGMENTS) return null;
  return normalizeSegments(out, durationMs);
}
