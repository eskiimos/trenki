/**
 * POST /api/microcycle/generate
 *
 * Атлет вручную собирает себе микроцикл. РУЧНАЯ генерация ВСЕГДА стартует
 * С СЕГОДНЯ (не ждём понедельника). Если уже есть активный (незакрытый) цикл —
 * это ПЕРЕСБОРКА: старый цикл удаляется и собирается новый с сегодня.
 *
 * Раньше для возвращающегося юзера генерация бралась со следующего понедельника
 * (getMicrocycleWeekStart) — поэтому «Пересобрать» создавал второй цикл на
 * будущую неделю, а текущая неделя оставалась пустой (баг, на который указал
 * босс). Cron авто-генерации по-прежнему передаёт свою дату (ближайший Пн) явно.
 *
 * Auth: httpOnly session cookie.
 *
 * Response 201 (создан): { status: 'CREATED', microcycleId, weekStartDate, cycleNumber, days, rebuilt }
 * Response 200 (был): { status: 'EXISTING', ... }
 * Response 404: профиль не найден.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireActiveSubscription } from '@/lib/coach/guards';
import { generateMicrocycleForUser } from '@/lib/microcycle/generate';
import { getMicrocycleStartDate } from '@/lib/microcycle/week-start';
import { MicrocycleStatus } from '@/generated/prisma';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  // Сборка микроцикла/календаря от ИИ — платная (Трек A, п.6f). В режиме 'off' —
  // сквозной пропуск (как requireAuthUser), при 'admins'/'on' — требует подписку.
  const auth = await requireActiveSubscription(request);
  if ('response' in auth) return auth.response;
  const userId = auth.user.id;

  // Незакрытый цикл (без фидбэка, не в архиве) → пересобираем: удаляем его и
  // его тренировки. Прирост за уже выполненные дни остаётся (CharacteristicHistory
  // не трогаем, FK sessionId — SetNull). Адаптация нового цикла пойдёт от
  // ПРЕДЫДУЩЕГО цикла с фидбэком (после удаления активного он станет lastCycle).
  const active = await prisma.microcycle.findFirst({
    where: { userId, feedback: null, status: { not: MicrocycleStatus.ARCHIVED } },
    orderBy: { cycleNumber: 'desc' },
    select: { id: true, days: { select: { workoutSessionId: true } } },
  });
  const rebuilt = !!active;
  if (active) {
    const sessionIds = active.days.map((d) => d.workoutSessionId).filter((x): x is string => !!x);
    await prisma.$transaction([
      prisma.microcycle.delete({ where: { id: active.id } }), // cascade → дни
      prisma.workoutSession.deleteMany({ where: { id: { in: sessionIds } } }),
    ]);
  }

  // Старт — сегодня (00:00 UTC). Структуру недели со старта посреди недели
  // движок собирает по методичке «старт с любого дня».
  const result = await generateMicrocycleForUser(userId, {
    startDate: getMicrocycleStartDate(new Date()),
  });

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
      rebuilt,
    },
    { status: result.status === 'CREATED' ? 201 : 200 },
  );
}
