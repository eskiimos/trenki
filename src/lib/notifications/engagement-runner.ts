/**
 * Вовлекающие пуши (engagement-nudges): онбординг-дрип, «серия под угрозой»,
 * «пропуск 2 дня», «гантели запылились». Что и кому — decideNudge (nudges.ts),
 * тексты — шаблоны из админки.
 *
 * Когда: вечером по МЕСТНОМУ времени игрока (настройка reminder.nudgeTime,
 * дефолт 18:00). Раньше крон шёл раз в сутки в 15:00 по часам сервера (Б5) —
 * «серию» напоминали днём, а у дальневосточников ночью. Теперь runner
 * вызывается поминутным кроном microcycle-reminders и берёт тех, у кого
 * местное время уже наступило, а сегодня их ещё не проверяли.
 *
 * Дедуп: User.lastNudgeOn — локальная дата, когда игрока ПРОВЕРИЛИ (пуш мог и
 * не уйти). Не больше одного нуджа в день; атомарный claim через updateMany —
 * параллельный тик не задвоит.
 */

import { prisma } from '@/lib/prisma';
import { sendUserPush } from '@/lib/coach/push';
import { hasPremium } from '@/lib/access';
import { logger } from '@/lib/logger';
import { getReminderSettings } from '@/lib/settings';
import { allowedOnReminderDay, decideNudge, inNudgeWindow, trainingRecency } from '@/lib/notifications/nudges';
import { calendarDayIndex } from '@/lib/gamification';
import { getPushTemplates } from '@/lib/notifications/templates-server';
import { DEFAULT_TZ, localDateStr, localMinuteOfDay } from '@/lib/notifications/local-time';
import { pushTag } from '@/lib/notifications/push-tag';
import { countedWorkoutWhere, STREAK_DAY_WORKOUTS } from '@/lib/stats/workout-definition';
import { UserRole } from '@/generated/prisma';

/** Предохранитель за один тик: не рассылаем лавину, хвост доберёт следующий тик. */
const MAX_BATCH = 200;

export interface EngagementRunResult {
  subscribed: number;
  due: number;
  sent: number;
  skipped: number;
  nudgeTime: string;
}

export async function runEngagementNudges(now: Date = new Date()): Promise<EngagementRunResult> {
  const { nudgeHour, nudgeMinute, nudgeTime } = await getReminderSettings();
  const target = nudgeHour * 60 + nudgeMinute;

  // Кандидаты: только те, у кого есть push-подписка (иначе пуш никуда не уйдёт).
  // У User нет обратной связи на PushSubscription — берём id отдельным запросом.
  const subs = await prisma.pushSubscription.findMany({
    where: { userId: { not: null } },
    select: { userId: true },
    distinct: ['userId'],
  });
  const subscribedIds = subs.map((s) => s.userId!).filter(Boolean);
  if (subscribedIds.length === 0) return { subscribed: 0, due: 0, sent: 0, skipped: 0, nudgeTime };

  const users = await prisma.user.findMany({
    where: {
      id: { in: subscribedIds },
      role: UserRole.ATHLETE, // тренерам атлетский дрип не нужен (у них нет своих тренировок)
    },
    // Кого дольше всех не проверяли — первыми, чтобы хвост за кэпом не голодал.
    orderBy: { lastNudgeOn: { sort: 'asc', nulls: 'first' } },
    select: {
      id: true,
      firstName: true,
      createdAt: true,
      timezone: true,
      accessTier: true,
      premiumUntil: true,
      nudgeStep: true,
      lastNudgeOn: true,
      lastDustyNudgeAt: true,
      lastReminderOn: true,
    },
  });

  // У кого сейчас окно вечерних пушей и кого сегодня ещё не проверяли.
  // Вне окна не клеймим: пропущенный вечер просто переходит на завтра.
  const due = users
    .filter((u) => inNudgeWindow(localMinuteOfDay(now, u.timezone), target))
    .map((u) => ({ u, today: localDateStr(now, u.timezone) }))
    .filter(({ u, today }) => u.lastNudgeOn !== today)
    .slice(0, MAX_BATCH);
  if (due.length === 0) return { subscribed: users.length, due: 0, sent: 0, skipped: 0, nudgeTime };

  const templates = await getPushTemplates();
  let sent = 0;
  let skipped = 0;

  for (const { u, today } of due) {
    // Та же таймзона, что у серии на главной (getGamificationSummary): МСК по умолчанию
    const tz = u.timezone || DEFAULT_TZ;
    try {
      // Атомарно отмечаем «проверен сегодня» — и пуш, и отказ считаются.
      const claim = await prisma.user.updateMany({
        where: { id: u.id, OR: [{ lastNudgeOn: null }, { lastNudgeOn: { not: today } }] },
        data: { lastNudgeOn: today },
      });
      if (claim.count !== 1) { skipped++; continue; }

      // Дни тренировок — ровно как серия на главной (Б2): полные и досрочные
      // (COMPLETED + PARTIAL), по completedAt. Раньше тут было только COMPLETED,
      // и число дней в пуше расходилось с главной. Последних 400 хватает на
      // любую реалистичную серию даже при нескольких тренировках в день.
      const history = await prisma.workoutSession.findMany({
        where: { ...countedWorkoutWhere(STREAK_DAY_WORKOUTS), userId: u.id },
        orderBy: { completedAt: 'desc' },
        select: { completedAt: true },
        take: 400,
      });
      const recency = trainingRecency(
        history.map((s) => s.completedAt!).filter(Boolean),
        now,
        tz,
      );

      const decision = decideNudge(
        {
          createdAt: u.createdAt,
          tz,
          name: u.firstName,
          ...recency,
          hasPremium: hasPremium(u),
          nudgeStep: u.nudgeStep,
          // Календарные дни: через 4 дня тот же вечер — 4, даже если тик пришёл
          // на пару минут раньше, чем ровно 96 часов назад
          daysSinceLastDusty: u.lastDustyNudgeAt
            ? calendarDayIndex(now, tz) - calendarDayIndex(u.lastDustyNudgeAt, tz)
            : null,
        },
        now,
        templates,
      );
      if (!decision) { skipped++; continue; }
      // Сегодня уже ушло напоминание по циклу — второй пуш только про серию (Б4).
      if (u.lastReminderOn === today && !allowedOnReminderDay(decision.kind)) { skipped++; continue; }

      if (decision.nextStep !== u.nudgeStep || decision.kind === 'dusty') {
        await prisma.user.update({
          where: { id: u.id },
          data: {
            nudgeStep: decision.nextStep,
            ...(decision.kind === 'dusty' ? { lastDustyNudgeAt: now } : {}),
          },
        });
      }

      sendUserPush(u.id, {
        title: decision.text.title,
        body: decision.text.body,
        url: decision.text.url,
        // Метка по треку: неоткрытый вчерашний нудж того же типа заменяется.
        tag: pushTag(`nudge-${decision.kind}`),
      }).catch((err) => logger.error('engagement nudge failed', err, { userId: u.id }));
      sent++;
    } catch (error) {
      skipped++;
      logger.error('engagement nudge user failed', error, { userId: u.id });
    }
  }

  return { subscribed: users.length, due: due.length, sent, skipped, nudgeTime };
}
