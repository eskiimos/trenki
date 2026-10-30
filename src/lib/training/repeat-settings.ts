import type { SegmentRepeatSettings } from '@/lib/pose/coaching-settings';
import { MAX_SEGMENTS, parseSegments } from '@/lib/pose/segments';

/** The ordinary player needs timings only, never reference frames or joint settings. */
export interface PlaybackRepeatSegment {
  startMs: number;
  endMs: number;
  repeat?: SegmentRepeatSettings;
}

interface RepeatReference {
  segments: unknown;
  durationSec: number;
}

export function playbackRepeatSegments(reference: RepeatReference | null | undefined): PlaybackRepeatSegment[] {
  if (!reference || !Number.isFinite(reference.durationSec) || reference.durationSec <= 0) return [];
  // PoseReference.durationSec is a summary rounded to tenths of a second.
  // Keep the original millisecond boundary within that rounding interval;
  // ordinary playback additionally checks the actual media duration.
  const durationMs = Math.round(reference.durationSec * 1000) + 50;
  if (!Number.isSafeInteger(durationMs)) return [];
  const raw = reference.segments;
  if (!Array.isArray(raw) || raw.length > MAX_SEGMENTS) return [];
  // Stored metadata must fail closed instead of turning an out-of-range or
  // reversed interval into a different exercise by clipping it for playback.
  if (raw.some((item) => !item || typeof item !== 'object'
    || typeof item.startMs !== 'number' || typeof item.endMs !== 'number'
    || !Number.isFinite(item.startMs) || !Number.isFinite(item.endMs)
    || item.startMs < 0 || item.endMs > durationMs || item.endMs <= item.startMs)) return [];
  const segments = parseSegments(raw, durationMs);
  if (!segments) return [];
  const exercises = segments.filter((segment) => segment.assessment?.enabled !== false);
  if (!exercises.some((segment) => segment.repeat?.enabled)) return [];
  // Keep following exercise boundaries even without a repeat: entering the
  // next working set cancels the previous set's delayed prompt.
  return exercises.map((segment) => ({
    startMs: segment.startMs,
    endMs: segment.endMs,
    ...(segment.repeat?.enabled ? { repeat: { ...segment.repeat } } : {}),
  }));
}
