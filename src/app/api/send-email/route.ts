/**
 * ⛔ ОТКЛЮЧЕНО (410 Gone).
 *
 * Раньше это был ОТКРЫТЫЙ РЕЛЕЙ: любой неавторизованный запрос мог разослать
 * письма от noreply@trenki.app (welcome/new-video) на произвольные адреса.
 * Транзакционные письма шлются серверными хелперами (src/lib/email.ts) из
 * доверенного кода, а кампании — через src/lib/email-campaigns.ts под auth/крон.
 * Публичный эндпоинт отправки писем не нужен и опасен — закрыт.
 *
 * НЕ путать с OTP-логином: он живёт в /api/auth/email/send-code и /verify-code.
 */

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const GONE = () =>
  NextResponse.json({ error: 'This endpoint has been removed' }, { status: 410 });

export async function POST() {
  return GONE();
}

export async function GET() {
  return GONE();
}
