import { MAX_SEGMENTS, normalizeSegments, type Segment } from './segments';

export const MIN_SEGMENT_MS = 500;

/** Exact, editable time; unlike the summary counter, never rounds whole seconds. */
export function formatSegmentTime(ms: number): string {
  const value = Math.max(0, Math.round(ms));
  return `${Math.floor(value / 60000)}:${String(Math.floor(value / 1000) % 60).padStart(2, '0')}.${String(value % 1000).padStart(3, '0')}`;
}

/** Seconds or minutes:seconds, with optional milliseconds and Russian decimal comma. */
export function parseSegmentTime(text: string): number | null {
  const value = text.trim().replace(',', '.');
  if (!/^\d+(?::[0-5]\d)?(?:\.\d{1,3})?$/.test(value)) return null;
  const parts = value.split(':');
  const seconds = Number(parts.at(-1));
  const ms = Math.round(((parts.length === 2 ? Number(parts[0]) * 60 : 0) + seconds) * 1000);
  return Number.isSafeInteger(ms) ? ms : null;
}

/** Reject invalid edits before the API's backwards-compatible normalization. */
export function editSegmentRange(
  segments: Segment[], index: number | null, startMs: number, endMs: number, durationMs: number,
): { segments: Segment[]; selectedIndex: number; error?: never } | { error: string } {
  if (![startMs, endMs].every(Number.isSafeInteger) || startMs < 0 || endMs > durationMs) {
    return { error: `Границы должны быть внутри видео: 0:00.000 — ${formatSegmentTime(durationMs)}.` };
  }
  if (endMs - startMs < MIN_SEGMENT_MS) return { error: 'Конец должен быть позже начала минимум на 0,5 секунды.' };
  if (index !== null && !segments[index]) return { error: 'Выберите существующий отрезок.' };
  if (index !== null && segments[index].repeat && segments[index].repeat.seekToMs > startMs) {
    return { error: 'Начало отрезка не может быть раньше точки повтора. Сначала измените время возврата перед подходом.' };
  }
  if (segments.some((s, i) => i !== index && startMs < s.endMs && endMs > s.startMs)) {
    return { error: 'Отрезок пересекается с другим рабочим отрезком. Измените начало или конец.' };
  }
  if (index === null && segments.length >= MAX_SEGMENTS) return { error: `Можно добавить не больше ${MAX_SEGMENTS} отрезков.` };
  const replacement = { ...(index === null ? {} : segments[index]), startMs, endMs };
  const next = normalizeSegments(index === null ? [...segments, replacement] : segments.map((s, i) => i === index ? replacement : s), durationMs);
  const midpoint = startMs + (endMs - startMs) / 2;
  return { segments: next, selectedIndex: next.findIndex((s) => midpoint >= s.startMs && midpoint < s.endMs) };
}

export function moveSegmentBoundary(segments: Segment[], index: number, edge: 'start' | 'end', ms: number, durationMs: number): Segment[] {
  const segment = segments[index];
  if (!segment) return segments;
  const startMs = edge === 'start' ? Math.max(segments[index - 1]?.endMs ?? 0, segment.repeat?.seekToMs ?? 0, Math.min(Math.round(ms), segment.endMs - MIN_SEGMENT_MS)) : segment.startMs;
  const endMs = edge === 'end' ? Math.min(segments[index + 1]?.startMs ?? durationMs, Math.max(Math.round(ms), segment.startMs + MIN_SEGMENT_MS)) : segment.endMs;
  return segments.map((s, i) => i === index ? { ...s, startMs, endMs } : s);
}
