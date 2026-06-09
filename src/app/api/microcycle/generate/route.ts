/**
 * POST /api/microcycle/generate
 *
 * Атлет генерирует себе микроцикл — 5 тренировок (Пн-Пт) на эту неделю под
 * характеристики из профиля. Идемпотентен по weekStartDate.
 *
 * Реальная работа — в `generateMicrocycleForUser` (`@/lib/microcycle/generate`),
 * который дёргается и из cron'а для авто-генерации.
 *
 * Auth: httpOnly session cookie.
 *
 * Response 201 (создан): { status: 'CREATED', microcycleId, weekStartDate, cycleNumber, days }
 * Response 200 (был): { status: 'EXISTING', ... }
 * Response 404: профиль не найден.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuthUser } from '@/lib/coach/guards';
import { generateMicrocycleForUser } from '@/lib/microcycle/generate';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const auth = await requireAuthUser(request);
  if ('response' in auth) return auth.response;

  const result = await generateMicrocycleForUser(auth.user.id);

  if (result.status === 'NO_PROFILE') {
    return NextResponse.json(
      {
        error: 'Профиль не найден. Пройдите онбординг.',
        redirectTo: '/onboarding/characteristics',
      },
      { status: 404 },
    );
  }

  return NextResponse.json(
    {
      status: result.status,
      microcycleId: result.microcycleId,
      weekStartDate: result.weekStartDate,
      cycleNumber: result.cycleNumber,
      days: result.days,
    },
    { status: result.status === 'CREATED' ? 201 : 200 },
  );
}
