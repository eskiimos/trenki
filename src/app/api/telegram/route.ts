import { NextResponse } from 'next/server';

const GONE = {
  error: 'Telegram integration is disabled',
} as const;

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(GONE, { status: 410 });
}

export async function POST() {
  return NextResponse.json(GONE, { status: 410 });
}
