/**
 * Legacy cron endpoint. Microcycles are now created only when the athlete
 * presses the generation button. Keep an authenticated no-op response so an
 * existing server crontab cannot silently create another week.
 */

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error('❌ CRON_SECRET не задан в env');
    return NextResponse.json({ error: 'Cron is not configured' }, { status: 500 });
  }
  if (request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json({
    disabled: true,
    reason: 'manual_generation_only',
    total: 0,
    created: 0,
    existing: 0,
    noProfile: 0,
    paywalledSkipped: 0,
    errored: 0,
    durationMs: 0,
  });
}
