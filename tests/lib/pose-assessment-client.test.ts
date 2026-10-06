import { afterEach, describe, expect, it, vi } from 'vitest';
import { gzipSync } from 'node:zlib';
import { loadAssessmentReference } from '../../src/components/admin/pose/reference-client';

const doc = { v: 1, model: 'pose_landmarker_heavy', fps: 10, durationMs: 1000, width: 640, height: 360, frames: [[0], [100]] };
const reference = { model: doc.model, fps: 10, frameCount: 2, durationSec: 1, segments: [{ startMs: 0, endMs: 1000 }], updatedAt: '2026-10-06T00:00:00Z' };
const detail = { video: { id: 'test', title: 'Test', duration: 1, trainer: null }, playbackUrl: '/video.mp4', reference };
const json = (value: unknown, status = 200) => Response.json(value, { status });
const frames = () => new Response(new Uint8Array(gzipSync(JSON.stringify(doc))));

afterEach(() => vi.unstubAllGlobals());

describe('admin assessment reference loading', () => {
  it('loads and decompresses a stable reference through guarded endpoints', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(json(detail)).mockResolvedValueOnce(frames()).mockResolvedValueOnce(json(detail));
    vi.stubGlobal('fetch', fetcher);
    const controller = new AbortController();
    const result = await loadAssessmentReference('test', controller.signal);
    expect(result.doc).toEqual(doc);
    expect(result.detail.reference?.segments).toEqual(reference.segments);
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual(['/api/admin/pose-references/test', '/api/admin/pose-references/test/frames', '/api/admin/pose-references/test']);
    expect(fetcher.mock.calls.every(([, options]) => options.signal === controller.signal && options.cache === 'no-store')).toBe(true);
  });

  it('reports unauthorized metadata without trying to fetch frames', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(json({ error: 'Unauthorized' }, 401));
    vi.stubGlobal('fetch', fetcher);
    await expect(loadAssessmentReference('test', new AbortController().signal)).rejects.toThrow('Unauthorized');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('requires a saved reference', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(json({ ...detail, reference: null }));
    vi.stubGlobal('fetch', fetcher);
    await expect(loadAssessmentReference('test', new AbortController().signal)).rejects.toThrow('Сначала создайте');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('rejects a replaced reference instead of mixing old segments with new frames', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(json(detail)).mockResolvedValueOnce(frames())
      .mockResolvedValueOnce(json({ ...detail, reference: { ...reference, updatedAt: '2026-10-06T01:00:00Z' } })));
    await expect(loadAssessmentReference('test', new AbortController().signal)).rejects.toThrow('обновился');
  });

  it('rejects invalid work intervals before rendering the evaluator', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(json({ ...detail, reference: { ...reference, segments: [{ startMs: 'oops', endMs: 1000 }] } }))
      .mockResolvedValueOnce(frames()));
    await expect(loadAssessmentReference('test', new AbortController().signal)).rejects.toThrow('Разметка');
  });

  it('keeps an empty work list empty instead of silently evaluating explanations', async () => {
    const empty = { ...detail, reference: { ...reference, segments: null } };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(json(empty)).mockResolvedValueOnce(frames()).mockResolvedValueOnce(json(empty)));
    expect((await loadAssessmentReference('test', new AbortController().signal)).detail.reference?.segments).toEqual([]);
  });

  it('does not return a loaded document after cancellation', async () => {
    const controller = new AbortController();
    const fetcher = vi.fn().mockResolvedValueOnce(json(detail)).mockImplementationOnce(async () => { controller.abort(); return frames(); });
    vi.stubGlobal('fetch', fetcher);
    await expect(loadAssessmentReference('test', controller.signal)).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
