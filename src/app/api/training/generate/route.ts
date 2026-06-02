import { NextResponse } from 'next/server';

/**
 * POST /api/training/generate
 *
 * DEPRECATED. Используйте /api/training/generate-v3.
 * Этот endpoint удалён, потому что:
 *  - доверял userId из body (IDOR),
 *  - искал юзера по telegramId (не работает для email-юзеров),
 *  - продублирован generate-v3 с серверной сессией.
 */
export async function POST() {
  return NextResponse.json(
    { error: 'Этот endpoint удалён. Используйте POST /api/training/generate-v3.' },
    { status: 410 }
  );
}
