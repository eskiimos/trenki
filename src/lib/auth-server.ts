import { NextRequest } from 'next/server';

/**
 * Helper to extract telegramId from request in a consistent way.
 * Checks:
 * 1. Cookies (secure, persistent)
 * 2. Custom Header (for client-side calls where cookie might be missing)
 * 3. Search Params (for simple GET requests)
 */
export function getTelegramId(req: NextRequest): string | null {
  // 1. Try to get from cookies
  const cookieId = req.cookies.get('telegramId')?.value;
  if (cookieId) return cookieId;

  // 2. Try to get from headers (useful if client sends it manually)
  const headerId = req.headers.get('x-telegram-id');
  if (headerId) return headerId;

  // 3. Try to get from search params (for GET requests)
  const { searchParams } = new URL(req.url);
  const paramId = searchParams.get('telegramId');
  if (paramId) return paramId;

  return null;
}
