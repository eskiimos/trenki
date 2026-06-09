/**
 * Cron: авто-генерация микроциклов на новую неделю.
 *
 * Запускается раз в неделю — рекомендую воскресенье 18:00 по таймзоне
 * сервера (host crontab на reg.ru):
 *
 *   0 18 * * 0 curl -s -H "Authorization: Bearer $CRON_SECRET" \
 *     http://localhost:3000/api/cron/microcycle-autogenerate
 *
 * Логика:
 *   1. Берём всех атлетов с профилем и autoGenerateMicrocycle=true.
 *   2. Для каждого вызываем generateMicrocycleForUser. Она идемпотентна —
 *      если цикл на эту weekStartDate уже создан, вернётся EXISTING.
 *   3. После CREATED — шлём web-push «новый микроцикл готов».
 *
 * Уведомления только в PWA (web-push), Telegram временно отключён — см.
 * CLAUDE.md, secrets.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendUserPush } from '@/lib/coach/push';
import { generateMicrocycleForUser } from '@/lib/microcycle/generate';
import { getMicrocycleWeekStart } from '@/lib/microcycle/week-start';
import { UserRole } from '@/generated/prisma';

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

  // Только атлеты, у которых есть профиль и опция включена.
  const eligible = await prisma.user.findMany({
    where: {
      role: UserRole.ATHLETE,
      profile: { is: { autoGenerateMicrocycle: true } },
    },
    select: { id: true },
  });

  const startedAt = Date.now();
  // Cron всегда стартует цикл с ближайшего понедельника — логика
  // «новая неделя». Ручной generate (через endpoint) использует today.
  const startDate = getMicrocycleWeekStart(new Date());
  let created = 0;
  let existing = 0;
  let noProfile = 0;
  let errored = 0;

  for (const u of eligible) {
    try {
      const result = await generateMicrocycleForUser(u.id, { startDate });
      if (result.status === 'CREATED') {
        created++;
        // Push (web-only, Telegram отключён). Не блокируем цикл.
        sendUserPush(u.id, {
          title: 'Новый микроцикл готов',
          body: 'ИИ-тренер собрал тебе неделю. Открой календарь.',
          url: '/calendar',
        }).catch((err) => console.error('push failed', u.id, err));
      } else if (result.status === 'EXISTING') {
        existing++;
      } else if (result.status === 'NO_PROFILE') {
        noProfile++;
      }
    } catch (err) {
      errored++;
      console.error('autogenerate failed for user', u.id, err);
    }
  }

  const durationMs = Date.now() - startedAt;
  return NextResponse.json({
    total: eligible.length,
    created,
    existing,
    noProfile,
    errored,
    durationMs,
  });
}
