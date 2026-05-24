import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Старый диагностический endpoint. Снят с публикации — утекал состояние БД.
export async function GET() {
  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}
