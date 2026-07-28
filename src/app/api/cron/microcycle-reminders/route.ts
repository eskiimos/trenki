/**
 * Cron: ежедневные напоминания о тренировке по недельному циклу (C-7).
 *
 * Ставить РАЗ В МИНУТУ (host crontab на reg.ru) — время напоминания теперь с
 * точностью до минуты и настраивается из админки (/admin/reminders, дефолт
 * 10:00). Роут шлёт каждому юзеру, когда у НЕГО наступает это локальное время
 * (по User.timezone, дефолт МСК) — так «по гео» без точного GPS. Дедуп по
 * локальной дате гарантирует один пуш в день:
 *
 *   * * * * * curl -s -H "Authorization: Bearer $CRON_SECRET" \
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
import { getReminderSettings } from '@/lib/settings';
import { buildDailyReminder } from '@/lib/notifications/reminder-texts';

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
  // Время ежедневного напоминания — из настроек (админка), дефолт 10:00.
  const { dailyHour, dailyMinute, dailyTime } = await getReminderSettings();
  const targetMinutes = dailyHour * 60 + dailyMinute;
  const pad = (n: number) => String(n).padStart(2, '0');
  // Локальная дата (YYYY-MM-DD) и минуты-от-полуночи в таймзоне юзера (Intl).
  // Дефолт — МСК (если tz битый).
  const localDateStr = (tz: string): string => {
    try { return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(now); }
    catch { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Moscow' }).format(now); }
  };
  const localMinuteOfDay = (tz: string): number => {
    const read = (zone: string) => {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: zone, hour: '2-digit', minute: '2-digit', hour12: false,
      }).formatToParts(now);
      const h = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
      const m = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
      // hour12:false может дать "24" в полночь — нормализуем через %24.
      return ((Number.isFinite(h) ? h : 0) % 24) * 60 + (Number.isFinite(m) ? m : 0);
    };
    try { return read(tz); } catch { return read('Europe/Moscow'); }
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
  let offHour = 0;      // ещё не наступило локальное время напоминания
  let alreadySent = 0;  // сегодня уже слали (дедуп)
  for (const [userId, info] of dueByUser) {
    // Шлём, когда локальное время юзера >= целевого; дедуп по локальной дате —
    // поминутный крон не задвоит, а пропущенный тик догонится тем же днём.
    if (localMinuteOfDay(info.tz) < targetMinutes) { offHour++; continue; }
    if (info.lastReminderOn === info.localDate) { alreadySent++; continue; }

    // Атомарно «занимаем» отправку на сегодня: при наложении двух прогонов крона
    // (минутный тик дольше минуты) гонку выиграет только один — count===1.
    const claim = await prisma.user.updateMany({
      where: { id: userId, OR: [{ lastReminderOn: null }, { lastReminderOn: { not: info.localDate } }] },
      data: { lastReminderOn: info.localDate },
    });
    if (claim.count !== 1) { alreadySent++; continue; }

    // Текст чередуется по дням (детерминированно от локальной даты и userId).
    const text = buildDailyReminder(info.localDate, userId, info.name, info.label);
    sendUserPush(userId, {
      title: text.title,
      body: text.body,
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
    alreadySent,
    targetTime: dailyTime,
    durationMs: Date.now() - startedAt,
  });
}
