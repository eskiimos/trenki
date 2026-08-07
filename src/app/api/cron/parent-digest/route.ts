/**
 * Cron: еженедельный email-дайджест родителям (role=PARENT) о прогрессе детей.
 *
 *   0 10 * * 1 curl -s -H "Authorization: Bearer $CRON_SECRET" \
 *     http://localhost:3000/api/cron/parent-digest
 *
 * Раз в неделю (утро понедельника — итоги прошедшей недели). Кандидаты: родители
 * с email и хотя бы одним привязанным ребёнком, кому не слали ≥ 6 дней (6, а не 7 —
 * чтобы недельный крон не «уплывал» на день из-за минутных сдвигов запуска).
 *
 * Дедуп: User.lastParentDigestAt + атомарный claim через updateMany — повторный
 * тик крона не задвоит письмо. Пустая неделя у всех детей (0 тренировок и
 * 0 модулей) — письмо не шлём, но claim НЕ откатываем: пустую неделю не ретраим,
 * следующая попытка — через неделю.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/email';
import { getGamificationSummary, getWeekActivity } from '@/lib/gamification-server';
import { buildParentDigest, formatWeekLabel, type DigestChild } from '@/lib/parent-digest';
import { logger } from '@/lib/logger';
import { UserRole } from '@/generated/prisma';

export const dynamic = 'force-dynamic';

const DAY_MS = 24 * 60 * 60 * 1000;
const MIN_INTERVAL_DAYS = 6; // недельный дайджест с суточным люфтом
const MAX_BATCH = 50; // предохранитель: не рассылаем лавину за один тик

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return NextResponse.json({ error: 'Cron is not configured' }, { status: 500 });
  if (request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const threshold = new Date(now.getTime() - MIN_INTERVAL_DAYS * DAY_MS);
  const dueCondition = {
    OR: [{ lastParentDigestAt: null }, { lastParentDigestAt: { lt: threshold } }],
  };
  const where = {
    role: UserRole.PARENT,
    email: { not: null },
    parentLinks: { some: {} }, // есть хотя бы один привязанный ребёнок
    ...dueCondition,
  };

  // Кому дольше всех не слали — первыми, чтобы хвост за кэпом не голодал вечно.
  const [total, parents] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { lastParentDigestAt: { sort: 'asc', nulls: 'first' } },
      select: { id: true, email: true },
      take: MAX_BATCH,
    }),
  ]);
  if (total > parents.length) {
    logger.warn('parent digest batch capped', { total, dropped: total - parents.length });
  }

  const weekLabel = formatWeekLabel(now);
  let sent = 0;
  let skippedEmpty = 0;
  let errors = 0;

  for (const parent of parents) {
    try {
      // Атомарно занимаем отправку (гонку параллельных тиков выиграет один).
      const claim = await prisma.user.updateMany({
        where: { id: parent.id, ...dueCondition },
        data: { lastParentDigestAt: now },
      });
      if (claim.count !== 1) continue;

      const links = await prisma.parentLink.findMany({
        where: { parentId: parent.id },
        orderBy: { createdAt: 'asc' },
        select: {
          child: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              profile: { select: { potential: true } },
            },
          },
        },
      });
      if (links.length === 0) {
        skippedEmpty++;
        continue;
      }

      const children: DigestChild[] = await Promise.all(
        links.map(async ({ child }) => {
          const [g, week] = await Promise.all([
            getGamificationSummary(child.id),
            getWeekActivity(child.id),
          ]);
          return {
            name: [child.firstName, child.lastName].filter(Boolean).join(' ') || 'Хоккеист',
            statusTitle: g.status.title,
            statusEmoji: g.status.emoji,
            level: g.level,
            streak: g.streak,
            weekWorkouts: week.workouts,
            weekModules: week.modules,
            potential: child.profile?.potential ?? null,
          };
        }),
      );

      const digest = buildParentDigest({ children, weekLabel });
      if (!digest) {
        // Пустая неделя у всех — claim остаётся, следующая попытка через неделю.
        skippedEmpty++;
        continue;
      }

      const res = await sendEmail({ to: parent.email!, subject: digest.subject, html: digest.html });
      if (res.success) {
        sent++;
      } else {
        errors++;
        // email в логи не пишем (PII) — достаточно userId
        logger.error('parent digest send failed', { userId: parent.id });
      }
    } catch (e) {
      errors++;
      logger.error('parent digest failed', { userId: parent.id, err: String(e) });
    }
  }

  return NextResponse.json({ candidates: parents.length, sent, skippedEmpty, errors });
}
