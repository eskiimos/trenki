import { validateReferenceDoc, type PoseReferenceDoc } from '@/lib/pose/reference';
import { parseSegments, type Segment } from '@/lib/pose/segments';

export interface ReferenceDetail {
  video: { id: string; title: string; duration: number; trainer: { name: string; lastName: string } | null };
  playbackUrl: string;
  reference: {
    model: string;
    fps: number;
    frameCount: number;
    durationSec: number;
    segments: Segment[] | null;
    updatedAt: string;
  } | null;
}

/** Admin guards remain on both endpoints; camera frames never leave the browser. */
export async function loadAssessmentReference(videoId: string, signal: AbortSignal) {
  const path = `/api/admin/pose-references/${encodeURIComponent(videoId)}`;
  const response = await fetch(path, { cache: 'no-store', signal });
  const detail: ReferenceDetail & { error?: string } = await response.json();
  if (!response.ok) throw new Error(detail.error || 'Не удалось загрузить видео');
  if (!detail.reference) throw new Error('Сначала создайте эталон этого видео');
  if (typeof DecompressionStream === 'undefined') throw new Error('Для теста нужен современный браузер с поддержкой распаковки эталонов');
  const frames = await fetch(`${path}/frames`, { cache: 'no-store', signal });
  if (!frames.ok || !frames.body) throw new Error('Не удалось загрузить кадры эталона');
  const json = await new Response(frames.body.pipeThrough(new DecompressionStream('gzip'))).text();
  signal.throwIfAborted();
  const doc: PoseReferenceDoc = JSON.parse(json);
  const invalid = validateReferenceDoc(doc);
  if (invalid) throw new Error(`Эталон повреждён: ${invalid}`);
  const segments = parseSegments(detail.reference.segments ?? [], doc.durationMs);
  if (!segments) throw new Error('Разметка рабочих отрезков повреждена. Сохраните её заново в эталоне');
  detail.reference.segments = segments;
  // Do not mix the metadata/segments of an old reference with a freshly replaced document.
  const check = await fetch(path, { cache: 'no-store', signal });
  const current: ReferenceDetail = await check.json();
  if (!check.ok || current.reference?.updatedAt !== detail.reference.updatedAt) {
    throw new Error('Эталон обновился во время загрузки. Откройте тест заново');
  }
  return { detail, doc };
}
