import { describe, it, expect } from 'vitest';
import { isSameOrigin } from '@/lib/same-origin';
import type { NextRequest } from 'next/server';

/** Минимальный фейк NextRequest: нужен только доступ к заголовкам. */
function req(headers: Record<string, string>): NextRequest {
  const h = new Headers(headers);
  return { headers: h } as unknown as NextRequest;
}

describe('isSameOrigin', () => {
  it('свой origin пропускается', () => {
    expect(isSameOrigin(req({ origin: 'https://trenki.app', host: 'trenki.app' }))).toBe(true);
  });

  it('x-forwarded-host НЕ доверяем: nginx его не ставит, клиент подделает', () => {
    // Сверяемся только с `host` (его выставляет наш nginx). Иначе
    // curl -H 'Origin: https://evil.tld' -H 'X-Forwarded-Host: evil.tld'
    // проходил бы проверку.
    expect(
      isSameOrigin(
        req({
          origin: 'https://evil.tld',
          host: 'trenki.app',
          'x-forwarded-host': 'evil.tld',
        }),
      ),
    ).toBe(false);
  });

  it('ПОДДОМЕН отклоняется (SameSite=Lax его не режет)', () => {
    // adaptive.trenki.app — same-site для cookie, но чужой origin для нас.
    expect(
      isSameOrigin(req({ origin: 'https://adaptive.trenki.app', host: 'trenki.app' })),
    ).toBe(false);
  });

  it('чужой сайт отклоняется', () => {
    expect(isSameOrigin(req({ origin: 'https://evil.example', host: 'trenki.app' }))).toBe(false);
  });

  it('без Origin отклоняется (форма/не-браузерный вызов)', () => {
    expect(isSameOrigin(req({ host: 'trenki.app' }))).toBe(false);
  });

  it('битый Origin отклоняется', () => {
    // Только ASCII: значения HTTP-заголовков — ByteString.
    expect(isSameOrigin(req({ origin: 'not-a-url', host: 'trenki.app' }))).toBe(false);
  });

  it('«null»-origin (песочница/редирект) отклоняется', () => {
    expect(isSameOrigin(req({ origin: 'null', host: 'trenki.app' }))).toBe(false);
  });
});
