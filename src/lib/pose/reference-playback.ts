/** Keep admin seeks inside both the reference and the actual media when metadata is available. */
export function clampReferenceSeek(ms: number, durationMs: number, mediaDurationSec = NaN): number {
  const referenceEnd = Number.isFinite(durationMs) ? Math.max(0, durationMs) : 0;
  const end = Number.isFinite(mediaDurationSec) && mediaDurationSec >= 0
    ? Math.min(referenceEnd, mediaDurationSec * 1000)
    : referenceEnd;
  return Number.isFinite(ms) ? Math.max(0, Math.min(end, ms)) : 0;
}
