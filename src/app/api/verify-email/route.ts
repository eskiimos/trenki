/**
 * ⛔ ОТКЛЮЧЕНО (410 Gone).
 *
 * Раньше это был ОТКРЫТЫЙ РЕЛЕЙ: неавторизованный POST рассылал письма с кодом
 * от noreply@trenki.app на любой адрес (спам/абьюз), а коды хранились в памяти
 * процесса. Боевой email-OTP логин живёт в /api/auth/email/send-code и
 * /api/auth/email/verify-code (БД, rate-limit) — этот легаси-эндпоинт закрыт.
 *
 * НЕ путать с verify-code (боевой OTP). Это разные роуты.
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
