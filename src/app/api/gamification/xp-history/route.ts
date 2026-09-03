// История начислений XP текущего игрока (правка владельца «Начало сентября»).
// XP в БД не хранится — события выводятся из той же истории завершений, что и
// сводка (/api/gamification/summary), поэтому итог совпадает с ней.

import { NextRequest, NextResponse } from 'next/server';
import { requireAuthUser } from '@/lib/coach/guards';
import { prisma } from '@/lib/prisma';
import { fetchCompletionHistory, userTimezone } from '@/lib/gamification-server';
import { xpEventsFromHistory, summarizeXpHistory } from '@/lib/gamification';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await requireAuthUser(request);
  if ('response' in auth) return auth.response;

  const [{ workoutAts, moduleAts, trainingDayAts }, tz, checkins] = await Promise.all([
    fetchCompletionHistory(auth.user.id),
    userTimezone(auth.user.id),
    prisma.dailyCheckin.findMany({ where: { userId: auth.user.id }, select: { date: true } }),
  ]);

  const summary = summarizeXpHistory(
    xpEventsFromHistory(
      workoutAts,
      moduleAts,
      trainingDayAts,
      checkins.map((c) => c.date),
      tz,
    ),
  );
  return NextResponse.json(summary);
}
