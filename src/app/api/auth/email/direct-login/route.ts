import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Бывший бэкдор-логин по email без OTP. Закрыт навсегда.
const GONE = { error: 'Endpoint disabled. Use /api/auth/email/send-code + verify-code.' } as const;

export async function GET() {
  return NextResponse.json(GONE, { status: 410 });
}

export async function POST() {
  return NextResponse.json(GONE, { status: 410 });
}
