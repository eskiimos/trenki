import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuthUser } from '@/lib/coach/guards';
import { WorkoutStatus } from '@/generated/prisma';

// QA-инструменты для админа (для прогонки методички микроцикла без ожидания
// реальной недели). Только для пользователей с isAdmin. Все действия работают
// СТРОГО над собственными данными вызывающего (userId из сессии).
//
// POST /api/dev/microcycle  { action: 'complete' | 'clear-calendar' }
//  - complete       — отметить активный цикл выполненным и «состарить» его,
//                     чтобы на главной выскочил опросник переносимости.
//  - clear-calendar — удалить свои микроциклы, их тренировки и расписание
//                     (чистый старт для повторного теста).

export async function POST(request: NextRequest) {
  const auth = await requireAuthUser(request);
  if ('response' in auth) return auth.response;
  if (!auth.user.isAdmin) {
    return NextResponse.json({ error: 'Только для администратора' }, { status: 403 });
  }
  const userId = auth.user.id;
  const action = (await request.json().catch(() => ({})))?.action;

  if (action === 'clear-calendar') {
    const mcs = await prisma.microcycle.findMany({
      where: { userId },
      select: { id: true, days: { select: { workoutSessionId: true } } },
    });
    const sessionIds = mcs
      .flatMap((m) => m.days.map((d) => d.workoutSessionId))
      .filter((x): x is string => !!x);

    const [, delSessions, delScheduled] = await prisma.$transaction([
      prisma.microcycle.deleteMany({ where: { userId } }), // cascade → дни
      prisma.workoutSession.deleteMany({ where: { id: { in: sessionIds } } }), // cascade → видео сессии
      prisma.scheduledWorkout.deleteMany({ where: { userId } }),
    ]);

    return NextResponse.json({
      ok: true,
      deleted: { microcycles: mcs.length, sessions: delSessions.count, scheduled: delScheduled.count },
      message: 'Календарь очищен: микроциклы, их тренировки и расписание удалены.',
    });
  }

  if (action === 'complete') {
    // Последний незакрытый цикл (без фидбэка и не в архиве).
    const mc = await prisma.microcycle.findFirst({
      where: { userId, feedback: null, status: { not: 'ARCHIVED' } },
      orderBy: { cycleNumber: 'desc' },
      select: { id: true, days: { select: { workoutSessionId: true } } },
    });
    if (!mc) {
      return NextResponse.json({ error: 'Нет активного цикла для прогонки' }, { status: 404 });
    }
    const sessionIds = mc.days.map((d) => d.workoutSessionId).filter((x): x is string => !!x);
    const now = new Date();
    const dayCount = mc.days.length || 5;

    // Отмечаем все тренировки цикла выполненными.
    await prisma.$transaction([
      prisma.workoutSessionVideo.updateMany({
        where: { sessionId: { in: sessionIds } },
        data: { completed: true, completedAt: now },
      }),
      prisma.workoutSession.updateMany({
        where: { id: { in: sessionIds } },
        data: { status: WorkoutStatus.COMPLETED, completedAt: now },
      }),
    ]);

    // «Состариваем» цикл, чтобы он стал AWAITING_FEEDBACK (опрос на главной).
    // weekStartDate + dayCount должно быть в прошлом. Ловим коллизию unique
    // (userId, weekStartDate) — отодвигаем дальше в прошлое.
    let applied = false;
    for (const extra of [1, 8, 15, 30]) {
      const back = new Date(Date.UTC(
        now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - (dayCount + extra), 0, 0, 0, 0,
      ));
      try {
        await prisma.microcycle.update({ where: { id: mc.id }, data: { weekStartDate: back } });
        applied = true;
        break;
      } catch (e: any) {
        if (e?.code !== 'P2002') throw e; // не коллизия — пробрасываем
      }
    }

    return NextResponse.json({
      ok: true,
      microcycleId: mc.id,
      aged: applied,
      message: applied
        ? 'Цикл выполнен и закрыт. Открой главную — там опросник переносимости.'
        : 'Цикл выполнен, но дату сдвинуть не удалось (коллизия). Опрос может не появиться.',
    });
  }

  return NextResponse.json({ error: 'Неизвестное действие' }, { status: 400 });
}
