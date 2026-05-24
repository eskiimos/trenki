import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const GONE = { error: 'Telegram login is disabled' } as const;

export async function GET() {
  return NextResponse.json(GONE, { status: 410 });
}

export async function POST() {
  return NextResponse.json(GONE, { status: 410 });
}
