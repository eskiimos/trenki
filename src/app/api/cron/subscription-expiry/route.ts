/**
 * Cron: уведомление «подписка скоро закончится» (Трек A, п.5).
 *
 * Ставить раз в час (или в день) — host crontab на reg.ru, тем же Bearer, что и
 * остальные кроны:
 *   0 * * * * curl -s -H "Authorization: Bearer $CRON_SECRET" \
 *     http://localhost:3000/api/cron/subscription-expiry
 *
 * Логика: берём PREMIUM-юзеров с конечным premiumUntil в окне [now, now+3d] и
 * шлём web-push с обратным отсчётом. Дедуп — value-based по User.expiryReminderSentFor
 * (ISO premiumUntil, о котором уже предупредили): один пуш за период, и он
 * ПЕРЕАРМИТСЯ при продлении (premiumUntil изменится). Бессрочный премиум
 * (premiumUntil=null) в окно не попадает. Атомарный claim через updateMany —
 * повторные тики крона не задвоят пуш.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendUserPush } from '@/lib/coach/push';
import { getPaywallMode } from '@/lib/settings';
import { AccessTier } from '@/generated/prisma';

export const dynamic = 'force-dynamic';

const WINDOW_DAYS = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

function pluralDays(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'день';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'дня';
  return 'дней';
}

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error('❌ CRON_SECRET не задан в env');
    return NextResponse.json({ error: 'Cron is not configured' }, { status: 500 });
  }
  if (request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Пока paywall выключен — не шлём уведомления о продлении (иначе в 'off'
  // премиум-юзеры получали бы пуши там, где до paywall их не было).
  if ((await getPaywallMode()) === 'off') {
    return NextResponse.json({ skipped: 'paywall off', sent: 0 });
  }

  const startedAt = Date.now();
  const now = new Date();
  const windowEnd = new Date(now.getTime() + WINDOW_DAYS * DAY_MS);

  const candidates = await prisma.user.findMany({
    where: {
      accessTier: AccessTier.PREMIUM,
      premiumUntil: { gt: now, lte: windowEnd },
    },
    select: { id: true, firstName: true, premiumUntil: true, expiryReminderSentFor: true },
  });

  let sent = 0;
  let alreadySent = 0;
  for (const u of candidates) {
    if (!u.premiumUntil) continue;
    const iso = u.premiumUntil.toISOString();
    if (u.expiryReminderSentFor === iso) { alreadySent++; continue; }

    // Атомарно занимаем отправку для этого периода (гонку выиграет один тик).
    const claim = await prisma.user.updateMany({
      where: {
        id: u.id,
        OR: [{ expiryReminderSentFor: null }, { expiryReminderSentFor: { not: iso } }],
      },
      data: { expiryReminderSentFor: iso },
    });
    if (claim.count !== 1) { alreadySent++; continue; }

    const msLeft = u.premiumUntil.getTime() - now.getTime();
    const days = Math.ceil(msLeft / DAY_MS);
    // premiumUntil всегда > now (фильтр gt), поэтому days >= 1; при <24ч — «менее суток».
    const when = msLeft < DAY_MS ? 'менее чем через сутки' : `через ${days} ${pluralDays(days)}`;
    sendUserPush(u.id, {
      title: 'Подписка скоро закончится',
      body: `Доступ ко всем возможностям заканчивается ${when}. Продли, чтобы не потерять прогресс.`,
      url: '/profile',
    }).catch((err) => console.error('subscription-expiry push failed', u.id, err));
    sent++;
  }

  return NextResponse.json({
    candidates: candidates.length,
    sent,
    alreadySent,
    durationMs: Date.now() - startedAt,
  });
}
