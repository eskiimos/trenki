/**
 * Cron: вовлекающие пуши — онбординг-дрип, «серия под угрозой», «пропуск
 * 2 дня», «гантели запылились». Логика — src/lib/notifications/engagement-runner.ts.
 *
 *   0 15 * * * curl -s -H "Authorization: Bearer $CRON_SECRET" \
 *     http://localhost:3000/api/cron/engagement-nudges
 *
 * С 22.09 основной запуск — из поминутного крона microcycle-reminders: пуши
 * уходят вечером по местному времени игрока (настройка в /admin/reminders).
 * Этот роут оставлен для совместимости со старой строкой crontab и ручного
 * запуска: он делает то же самое и берёт только тех, чьё время уже наступило,
 * поэтому лишнего не отправит.
 */

import { NextRequest, NextResponse } from 'next/server';
import { runEngagementNudges } from '@/lib/notifications/engagement-runner';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return NextResponse.json({ error: 'Cron is not configured' }, { status: 500 });
  if (request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    return NextResponse.json(await runEngagementNudges());
  } catch (error) {
    logger.error('engagement nudges failed', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
