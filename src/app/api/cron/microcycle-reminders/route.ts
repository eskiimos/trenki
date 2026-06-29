/**
 * Cron: ежедневные напоминания о тренировке по недельному циклу (C-7).
 *
 * Ставить ПОЧАСОВО (host crontab на reg.ru). Роут шлёт напоминание каждому
 * пользователю, когда у НЕГО локальные 10:00 (по User.timezone, дефолт МСК) —
 * так «по гео» без точного GPS. На каждом часе отправляются только те, у кого
 * сейчас 10:00; выходные/дни без цикла/выполненные отсеются логикой:
 *
 *   0 * * * * curl -s -H "Authorization: Bearer $CRON_SECRET" \
 *     http://localhost:3000/api/cron/microcycle-reminders
 *
 * Логика:
 *   1. Берём активные микроциклы, чья неделя покрывает сегодня.
 *   2. Находим день, чья календарная дата == сегодня.
 *   3. C-5: НЕ напоминаем, если тренировка дня уже выполнена (status COMPLETED) —
 *      даже если её сделали раньше срока. Признак — статус связанной сессии,
 *      см. isReminderDueForDay.
 *   4. Шлём web-push с подписью дня (Заряжен/Разминка/Растяжка/В тонусе/Устал).
 *
 * Push только в PWA (web-push), Telegram отключён — см. CLAUDE.md.
 * Идемпотентность в пределах суток обеспечивается тем, что крон ставится один
 * раз в день; повторный ручной вызов в тот же день пошлёт пуш снова.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendUserPush } from '@/lib/coach/push';
import { getMicrocycleStartDate, getMicrocycleDayDate } from '@/lib/microcycle/week-start';
import { isReminderDueForDay } from '@/lib/microcycle/reminders';
import { parsePrevDay, labelFor } from '@/lib/microcycle/week-plan';
import { MicrocycleStatus } from '@/generated/prisma';

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

  const startedAt = Date.now();
  const now = new Date();
  // «Сегодня» считаем по UTC-дате (как и weekStartDate @db.Date). Крон ставится
  // по локальному времени сервера — час запуска должен быть таким, чтобы его
  // UTC-дата совпадала с локальной (напр. 09:00 MSK = 06:00 UTC, та же дата).
  const today = getMicrocycleStartDate(now);
  // Цикл покрывает сегодня, если weekStartDate в [today-4; today] (5 дней: +0..+4).
  const rangeStart = new Date(Date.UTC(
    today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - 4, 0, 0, 0, 0,
  ));

  const cycles = await prisma.microcycle.findMany({
    where: {
      status: MicrocycleStatus.ACTIVE,
      weekStartDate: { gte: rangeStart, lte: today },
    },
    include: {
      user: { select: { id: true, firstName: true, timezone: true } },
      days: { include: { workoutSession: { select: { status: true } } } },
    },
  });

  // Напоминание шлём в ~10:00 ЛОКАЛЬНОГО времени пользователя (таймзона —
  // User.timezone, по умолчанию МСК). Крон ставится почасовым: на каждом часе
  // отправляем тем, у кого сейчас локальные 10:00. Так «по гео» без точного GPS.
  const TARGET_HOUR = 10;
  const localHour = (at: Date, tz: string): number => {
    try {
      return parseInt(new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: '2-digit', hour12: false }).format(at), 10);
    } catch {
      return parseInt(new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Moscow', hour: '2-digit', hour12: false }).format(at), 10);
    }
  };

  // Собираем по одному напоминанию НА ПОЛЬЗОВАТЕЛЯ: у юзера может быть несколько
  // ACTIVE-циклов с перекрытием дней (статус ACTIVE не снимается без фидбэка),
  // поэтому без дедупа он получил бы 2+ пуша в день. При перекрытии берём день
  // самого свежего цикла (по weekStartDate).
  const dueByUser = new Map<string, { name: string | null; label: string; weekStartMs: number; tz: string }>();
  let skipped = 0; // сегодня — день цикла, но он уже закрыт / без сессии
  let noDayToday = 0; // у цикла нет дня на сегодня (выходной/вне недели)

  for (const cycle of cycles) {
    // День, чья календарная дата == сегодня (без учёта закрытости).
    const day = cycle.days.find(
      (d) =>
        d.dayOfWeek >= 1 &&
        d.dayOfWeek <= 5 &&
        getMicrocycleDayDate(cycle.weekStartDate, d.dayOfWeek).getTime() === today.getTime(),
    );

    if (!day) {
      noDayToday++;
      continue;
    }

    const due = isReminderDueForDay({
      today,
      weekStartDate: cycle.weekStartDate,
      dayOfWeek: day.dayOfWeek,
      hasSession: day.workoutSessionId != null,
      sessionStatus: day.workoutSession?.status ?? null,
    });

    if (!due) {
      skipped++; // C-5: выполнено/отменено, либо нет сессии — не напоминаем
      continue;
    }

    const state = parsePrevDay(day.dayOfWeek, day.intent);
    const label = labelFor(state.kind, state.energyState);
    const weekStartMs = cycle.weekStartDate.getTime();
    const prev = dueByUser.get(cycle.user.id);
    if (!prev || weekStartMs > prev.weekStartMs) {
      dueByUser.set(cycle.user.id, { name: cycle.user.firstName, label, weekStartMs, tz: cycle.user.timezone || 'Europe/Moscow' });
    }
  }

  let sent = 0;
  let offHour = 0; // юзер «должен», но сейчас не его локальные 10:00
  for (const [userId, info] of dueByUser) {
    if (localHour(now, info.tz) !== TARGET_HOUR) { offHour++; continue; }
    // Push не блокирует цикл; ошибки только логируем.
    sendUserPush(userId, {
      title: info.name ? `Привет, ${info.name}! Время тренировки 💪` : 'Время тренировки 💪',
      body: `Стабильность — признак мастерства. Не забудь потренироваться — сегодня у тебя «${info.label}».`,
      url: '/calendar',
    }).catch((err) => console.error('microcycle reminder push failed', userId, err));
    sent++;
  }

  return NextResponse.json({
    cycles: cycles.length,
    sent,
    skipped,
    noDayToday,
    offHour,
    targetHour: TARGET_HOUR,
    durationMs: Date.now() - startedAt,
  });
}
