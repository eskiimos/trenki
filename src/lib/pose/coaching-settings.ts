/** Video-level override: null keeps the automatic rule based on explicit theory tags. */
export function isTheoryVideo(tags: readonly string[] = []): boolean {
  return tags.some((tag) => typeof tag === 'string' && ['теория', 'theory'].includes(tag.trim().toLocaleLowerCase('ru-RU')));
}

export function effectiveVideoTrackingEnabled(override: boolean | null | undefined, tags: readonly string[] = []): boolean {
  return override ?? !isTheoryVideo(tags);
}

export interface SegmentRepeatSettings {
  enabled: boolean;
  /** Absolute media time to return to, including the preparation before the exercise. */
  seekToMs: number;
  promptDelayMs: number;
  promptDurationMs: number;
}

export const DEFAULT_REPEAT_DELAY_MS = 7000;
export const DEFAULT_REPEAT_DURATION_MS = 5000;
export const DEFAULT_REPEAT_PREROLL_MS = 15000;

export function defaultSegmentRepeat(startMs: number): SegmentRepeatSettings {
  return { enabled: false, seekToMs: Math.max(0, Math.round(startMs) - DEFAULT_REPEAT_PREROLL_MS), promptDelayMs: DEFAULT_REPEAT_DELAY_MS, promptDurationMs: DEFAULT_REPEAT_DURATION_MS };
}

/** No silent clipping: a configured repeat must still point before its exercise after boundary edits. */
export function parseSegmentRepeat(raw: unknown, startMs: number): SegmentRepeatSettings | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;
  if (typeof value.enabled !== 'boolean') return null;
  if (typeof value.seekToMs !== 'number' || !Number.isSafeInteger(value.seekToMs) || value.seekToMs < 0 || value.seekToMs > startMs) return null;
  if (typeof value.promptDelayMs !== 'number' || !Number.isSafeInteger(value.promptDelayMs) || value.promptDelayMs < 0 || value.promptDelayMs > 30000) return null;
  if (typeof value.promptDurationMs !== 'number' || !Number.isSafeInteger(value.promptDurationMs) || value.promptDurationMs < 1000 || value.promptDurationMs > 15000) return null;
  return { enabled: value.enabled, seekToMs: value.seekToMs, promptDelayMs: value.promptDelayMs, promptDurationMs: value.promptDurationMs };
}
