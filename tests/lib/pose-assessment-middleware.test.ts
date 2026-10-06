import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('../../src/lib/session', () => ({
  getSessionFromRequest: vi.fn().mockResolvedValue(null),
  SESSION_COOKIE_NAME: 'trenki_session',
}));
import { middleware } from '../../src/middleware';

afterEach(() => vi.unstubAllEnvs());

describe('production pose asset routing', () => {
  it.each(['/mediapipe/0.10.14/wasm/vision_wasm_internal.wasm', '/mediapipe/models/pose_landmarker_lite.task'])(
    'serves public algorithm assets without requiring an athlete JWT: %s', async (path) => {
      vi.stubEnv('NODE_ENV', 'production');
      const response = await middleware(new NextRequest(`https://trenki.app${path}`));
      expect(response.headers.get('location')).toBeNull();
      expect(response.headers.get('x-middleware-next')).toBe('1');
      expect(response.headers.get('Content-Security-Policy')).toContain('wasm-unsafe-eval');
    },
  );

  it('does not make paths sharing only a prefix public', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const response = await middleware(new NextRequest('https://trenki.app/mediapipe-private'));
    expect(response.headers.get('location')).toBe('https://trenki.app/login');
  });

  it('keeps assessment screens under the admin login boundary', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const response = await middleware(new NextRequest('https://trenki.app/admin/pose/test'));
    expect(response.headers.get('location')).toBe('https://trenki.app/admin/login');
  });
});
