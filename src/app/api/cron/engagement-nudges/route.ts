/**
 * Cron: вовлекающие пуши — онбординг-дрип и нудж «гантели запылились».
 *
 *   0 15 * * * curl -s -H "Authorization: Bearer $CRON_SECRET" \
 *     http://localhost:3000/api/cron/engagement-nudges
 *
 * Раз в сутки (днём). Два трека, приоритет у первого:
 *  1) ОНБОРДИНГ-ДРИП — зарегистрировался, но НИ РАЗУ не тренировался: серия из
 *     3 сообщений на 1-й, 3-й и 7-й день. Шаг фиксируется в User.nudgeStep.
 *  2) «ГАНТЕЛИ ЗАПЫЛИЛИСЬ» — без активной подписки и не тренировался
 *     DUSTY_AFTER_DAYS дней. Повторяется не чаще, чем раз в этот же интервал.
 *
 * Дедуп: User.lastNudgeOn (локальная дата) — не больше одного нуджа в день, плюс
 * НЕ шлём в день, когда человеку уже ушло дневное напоминание по микроциклу
 * (User.lastReminderOn) — два пуша об одном и том же раздражают.
 * Атомарный claim через updateMany — повторный тик крона не задвоит.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendUserPush } from '@/lib/coach/push';
import { hasPremium } from '@/lib/access';
import { decideNudge, DUSTY_AFTER_DAYS } from '@/lib/notifications/nudges';
import { WorkoutStatus } from '@/generated/prisma';

export const dynamic = 'force-dynamic';

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_BATCH = 500; // предохранитель: не рассылаем лавину за один тик

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return NextResponse.json({ error: 'Cron is not configured' }, { status: 500 });
  if (request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const localDate = (tz: string | null): string => {
    try {
      return new Intl.DateTimeFormat('en-CA', { timeZone: tz || 'Europe/Moscow' }).format(now);
    } catch {
      return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Moscow' }).format(now);
    }
  };

  // Кандидаты: только те, у кого есть push-подписка (иначе пуш никуда не уйдёт).
  // У User нет обратной связи на PushSubscription — берём id отдельным запросом.
  const subs = await prisma.pushSubscription.findMany({
    where: { userId: { not: null } },
    select: { userId: true },
    distinct: ['userId'],
  });
  const subscribedIds = subs.map((s) => s.userId!).filter(Boolean);
  if (subscribedIds.length === 0) {
    return NextResponse.json({ candidates: 0, sent: 0, skipped: 0 });
  }

  const users = await prisma.user.findMany({
    where: { id: { in: subscribedIds } },
    select: {
      id: true,
      createdAt: true,
      timezone: true,
      accessTier: true,
      premiumUntil: true,
      nudgeStep: true,
      lastNudgeOn: true,
      lastReminderOn: true,
    },
    take: MAX_BATCH,
  });

  let sent = 0;
  let skipped = 0;

  for (const u of users) {
    const today = localDate(u.timezone);

    // Уже слали сегодня нудж — или сегодня ушло дневное напоминание.
    if (u.lastNudgeOn === today || u.lastReminderOn === today) { skipped++; continue; }

    // Последняя ЗАВЕРШЁННАЯ тренировка — по ней считаем простой.
    const lastDone = await prisma.workoutSession.findFirst({
      where: { userId: u.id, status: WorkoutStatus.COMPLETED },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    const daysSince = lastDone
      ? Math.floor((now.getTime() - lastDone.createdAt.getTime()) / DAY_MS)
      : null;

    const decision = decideNudge(
      {
        createdAt: u.createdAt,
        everTrained: !!lastDone,
        daysSinceLastTraining: daysSince,
        hasPremium: hasPremium(u),
        nudgeStep: u.nudgeStep,
      },
      now,
    );
    if (!decision) { skipped++; continue; }

    // Атомарно занимаем отправку на сегодня (гонку выиграет один тик).
    const claim = await prisma.user.updateMany({
      where: { id: u.id, OR: [{ lastNudgeOn: null }, { lastNudgeOn: { not: today } }] },
      data: { lastNudgeOn: today, nudgeStep: decision.nextStep },
    });
    if (claim.count !== 1) { skipped++; continue; }

    sendUserPush(u.id, {
      title: decision.text.title,
      body: decision.text.body,
      url: decision.text.url,
    }).catch((err) => console.error('engagement nudge failed', u.id, err));
    sent++;
  }

  return NextResponse.json({ candidates: users.length, sent, skipped, dustyAfterDays: DUSTY_AFTER_DAYS });
}
