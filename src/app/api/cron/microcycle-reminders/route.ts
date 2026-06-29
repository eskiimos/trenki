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
 * Идемпотентность: дедуп по User.lastReminderOn (локальная дата последней
 * отправки) — повторные/двойные вызовы крона в тот же день НЕ задвоят пуш.
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
  const TARGET_HOUR = 10;
  const pad = (n: number) => String(n).padStart(2, '0');
  // Локальная дата (YYYY-MM-DD) и час в таймзоне юзера (Intl). Дефолт — МСК.
  const localDateStr = (tz: string): string => {
    try { return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(now); }
    catch { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Moscow' }).format(now); }
  };
  const localHour = (tz: string): number => {
    try { return parseInt(new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: '2-digit', hour12: false }).format(now), 10); }
    catch { return parseInt(new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Moscow', hour: '2-digit', hour12: false }).format(now), 10); }
  };
  // UTC-дата дня цикла как YYYY-MM-DD — для сравнения с локальной датой юзера.
  const dayDateStr = (ws: Date, dow: number): string => {
    const d = getMicrocycleDayDate(ws, dow);
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  };

  // Широкий диапазон по UTC покрывает «сегодня» в любой таймзоне (вост./зап.).
  const anchor = getMicrocycleStartDate(now);
  const rangeStart = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), anchor.getUTCDate() - 5, 0, 0, 0, 0));
  const rangeEnd = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), anchor.getUTCDate() + 1, 0, 0, 0, 0));

  const cycles = await prisma.microcycle.findMany({
    where: {
      status: MicrocycleStatus.ACTIVE,
      weekStartDate: { gte: rangeStart, lte: rangeEnd },
    },
    include: {
      user: { select: { id: true, firstName: true, timezone: true, lastReminderOn: true } },
      days: { include: { workoutSession: { select: { status: true } } } },
    },
  });

  // Один пуш на юзера. День определяем по ЕГО ЛОКАЛЬНОЙ дате (чинит сдвиг на
  // день у дальневосточных TZ). При нескольких ACTIVE-циклах берём свежайший.
  const dueByUser = new Map<string, { name: string | null; label: string; tz: string; localDate: string; lastReminderOn: string | null; weekStartMs: number }>();
  let skipped = 0; // день закрыт/без сессии
  let noDayToday = 0; // у цикла нет дня на локальное сегодня

  for (const cycle of cycles) {
    const tz = cycle.user.timezone || 'Europe/Moscow';
    const localDate = localDateStr(tz);
    const day = cycle.days.find(
      (d) => d.dayOfWeek >= 1 && d.dayOfWeek <= 5 && dayDateStr(cycle.weekStartDate, d.dayOfWeek) === localDate,
    );
    if (!day) { noDayToday++; continue; }

    const due = isReminderDueForDay({
      today: getMicrocycleDayDate(cycle.weekStartDate, day.dayOfWeek), // дата самого дня
      weekStartDate: cycle.weekStartDate,
      dayOfWeek: day.dayOfWeek,
      hasSession: day.workoutSessionId != null,
      sessionStatus: day.workoutSession?.status ?? null,
    });
    if (!due) { skipped++; continue; }

    const state = parsePrevDay(day.dayOfWeek, day.intent);
    const label = labelFor(state.kind, state.energyState);
    const weekStartMs = cycle.weekStartDate.getTime();
    const prev = dueByUser.get(cycle.user.id);
    if (!prev || weekStartMs > prev.weekStartMs) {
      dueByUser.set(cycle.user.id, { name: cycle.user.firstName, label, tz, localDate, lastReminderOn: cycle.user.lastReminderOn, weekStartMs });
    }
  }

  let sent = 0;
  let offHour = 0;      // ещё не наступили локальные 10:00
  let alreadySent = 0;  // сегодня уже слали (дедуп)
  for (const [userId, info] of dueByUser) {
    // Шлём с локальных 10:00 и позже; дедуп по локальной дате — почасовой крон не
    // задвоит, а пропущенный тик 10:00 догонится в тот же день (в 11:00 и т.д.).
    if (localHour(info.tz) < TARGET_HOUR) { offHour++; continue; }
    if (info.lastReminderOn === info.localDate) { alreadySent++; continue; }

    sendUserPush(userId, {
      title: info.name ? `Привет, ${info.name}! Время тренировки 💪` : 'Время тренировки 💪',
      body: `Стабильность — признак мастерства. Не забудь потренироваться — сегодня у тебя «${info.label}».`,
      url: '/calendar',
    }).catch((err) => console.error('microcycle reminder push failed', userId, err));
    await prisma.user.update({ where: { id: userId }, data: { lastReminderOn: info.localDate } });
    sent++;
  }

  return NextResponse.json({
    cycles: cycles.length,
    sent,
    skipped,
    noDayToday,
    offHour,
    alreadySent,
    targetHour: TARGET_HOUR,
    durationMs: Date.now() - startedAt,
  });
}
