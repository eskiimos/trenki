import { NextResponse } from 'next/server';
import { clearSessionCookie } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function POST() {
  const response = NextResponse.json({ success: true });
  clearSessionCookie(response);
  // На всякий случай чистим устаревшие cookie
  response.cookies.delete('telegramId');
  return response;
}
