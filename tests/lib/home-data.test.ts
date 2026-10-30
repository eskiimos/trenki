import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchHomeData } from '../../src/lib/home-data';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('initial home data requests', () => {
  it('aborts a stalled request so the page can settle into its error fallback', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn((_url: string, init: RequestInit) => new Promise((_resolve, reject) => {
      init.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    })));
    const result = fetchHomeData('/api/shorts').catch((error: Error) => error.name);
    await vi.advanceTimersByTimeAsync(8_000);
    expect(await result).toBe('AbortError');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('also bounds a response whose JSON body never finishes', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit) => ({
      ok: true,
      json: () => new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
      }),
    })));
    const result = fetchHomeData('/api/shorts').catch((error: Error) => error.name);
    await vi.advanceTimersByTimeAsync(8_000);
    expect(await result).toBe('AbortError');
  });

  it('rejects failed HTTP responses instead of treating them as an empty catalogue', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"error":"Unavailable"}', { status: 503 })));
    await expect(fetchHomeData('/api/shorts')).rejects.toThrow('503');
  });
});
