/**
 * Cron: письмо про неактивность (INACTIVITY-кампания).
 *
 *   0 12 * * * curl -s -H "Authorization: Bearer $CRON_SECRET" \
 *     http://localhost:3000/api/cron/inactivity-email
 *
 * Раз в сутки. Килл-свитч: если getEmailCampaignsEnabled() выключён — сразу
 * выходим ({skipped:'disabled'}), ни одного письма.
 *
 * Кандидаты: role=ATHLETE, есть email, не отписаны (emailOptOut=false), простой
 * ≥ 3 и ≤ 30 дней от ПОСЛЕДНЕГО ВХОДА (User.lastActivity — по решению владельца
 * именно lastActivity, НЕ последняя тренировка), и письмо про неактивность не
 * слали ≥ 7 дней (не чаще раза в неделю). ПРОПУСКАЕМ, если сегодня человеку уже
 * ушёл дневной нудж (lastNudgeOn) или напоминание (lastReminderOn) — чтобы push
 * и email не били в один день (сравнение локальной даты как в engagement-nudges).
 *
 * Дедуп: атомарный claim через updateMany(lastInactivityEmailAt) ПЕРЕД отправкой —
 * гонку параллельных тиков выигрывает один, двойной отправки не будет.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getEmailCampaignsEnabled } from '@/lib/settings';
import { sendInactivityEmail } from '@/lib/email-campaigns';
import { logger } from '@/lib/logger';
import { UserRole } from '@/generated/prisma';

export const dynamic = 'force-dynamic';

const DAY_MS = 24 * 60 * 60 * 1000;
const IDLE_MIN_DAYS = 3; // простой хотя бы 3 дня от последнего входа
const IDLE_MAX_DAYS = 30; // но не «мёртвые» дольше 30 дней — их не тревожим
const MIN_INTERVAL_DAYS = 7; // не чаще раза в неделю
const MAX_BATCH = 200; // предохранитель: не рассылаем лавину за один тик

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return NextResponse.json({ error: 'Cron is not configured' }, { status: 500 });
  if (request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Килл-свитч кампаний — читаем ОДИН раз здесь; функции отправки в цикле флаг
  // повторно не читают (см. sendInactivityEmail).
  if (!(await getEmailCampaignsEnabled())) {
    return NextResponse.json({ skipped: 'disabled' });
  }

  const now = new Date();
  const idleFrom = new Date(now.getTime() - IDLE_MAX_DAYS * DAY_MS); // lastActivity ≥ этого
  const idleUntil = new Date(now.getTime() - IDLE_MIN_DAYS * DAY_MS); // lastActivity ≤ этого
  const weekAgo = new Date(now.getTime() - MIN_INTERVAL_DAYS * DAY_MS);

  const dueCondition = {
    OR: [{ lastInactivityEmailAt: null }, { lastInactivityEmailAt: { lt: weekAgo } }],
  };
  const where = {
    role: UserRole.ATHLETE,
    email: { not: null },
    emailOptOut: false,
    lastActivity: { gte: idleFrom, lte: idleUntil },
    ...dueCondition,
  };

  // Локальная дата юзера (для сверки с lastNudgeOn/lastReminderOn — они хранятся
  // как локальные YYYY-MM-DD).
  const localDate = (tz: string | null): string => {
    try {
      return new Intl.DateTimeFormat('en-CA', { timeZone: tz || 'Europe/Moscow' }).format(now);
    } catch {
      return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Moscow' }).format(now);
    }
  };

  // Кому дольше всех не слали — первыми, чтобы хвост за кэпом не голодал вечно.
  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { lastInactivityEmailAt: { sort: 'asc', nulls: 'first' } },
      select: {
        id: true,
        email: true,
        emailOptOut: true,
        timezone: true,
        lastNudgeOn: true,
        lastReminderOn: true,
      },
      take: MAX_BATCH,
    }),
  ]);
  if (total > users.length) {
    logger.warn('inactivity email batch capped', { total, dropped: total - users.length });
  }

  let sent = 0;
  let skipped = 0;
  let errors = 0;

  for (const u of users) {
    const today = localDate(u.timezone);
    // Сегодня уже ушёл push (нудж/напоминание) — письмом не добиваем.
    if (u.lastNudgeOn === today || u.lastReminderOn === today) {
      skipped++;
      continue;
    }

    // Атомарно занимаем недельный слот отправки (гонку тиков выиграет один).
    const claim = await prisma.user.updateMany({
      where: { id: u.id, ...dueCondition },
      data: { lastInactivityEmailAt: now },
    });
    if (claim.count !== 1) {
      skipped++;
      continue;
    }

    const ok = await sendInactivityEmail({ id: u.id, email: u.email, emailOptOut: u.emailOptOut });
    if (ok) {
      sent++;
    } else {
      errors++;
      // claim НЕ откатываем: слот уже занят, повтор — на следующей неделе.
      logger.error('inactivity email send failed', { userId: u.id });
    }
  }

  return NextResponse.json({ candidates: users.length, sent, skipped, errors });
}
