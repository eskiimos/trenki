import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuthUser } from '@/lib/coach/guards';
import { MicrocycleFeedback, MicrocycleStatus, MicrocycleIntent } from '@/generated/prisma';
import { creditSessionCompletion } from '@/lib/training/credit-session';
import { generateMicrocycleForUser } from '@/lib/microcycle/generate';
import { getMicrocycleWeekStart } from '@/lib/microcycle/week-start';
import { parsePrevDay, labelFor } from '@/lib/microcycle/week-plan';

// QA-инструменты для админа (прогонка методички микроцикла без ожидания
// реальной недели). Только isAdmin. Все действия — СТРОГО над своими данными
// (userId из сессии).
//
// POST /api/dev/microcycle  { action }
//  - complete       — прожать активный цикл: НАЧИСЛИТЬ прирост за все его
//                     тренировки (как реальное прохождение) и «состарить» цикл,
//                     чтобы на главной выскочил опросник переносимости.
//  - clear-calendar — снести свои микроциклы, их тренировки и расписание.
//  - run { cycles, feedback } — прогнать насквозь N циклов (1..10) с одним
//                     ответом-фидбэком (EASY/NORMAL/HARD): чистый старт →
//                     генерим неделю → начисляем прирост → ставим фидбэк →
//                     генерим следующую (с адаптацией методички) → … Возвращает
//                     таймлайн структуры недель и рост потенциала.

const WD = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

function labelForIntent(intent: MicrocycleIntent): string {
  const s = parsePrevDay(1, intent);
  return labelFor(s.kind, s.energyState);
}

function weekdayShort(weekStart: Date, dayOfWeek: number): string {
  const d = new Date(Date.UTC(
    weekStart.getUTCFullYear(), weekStart.getUTCMonth(), weekStart.getUTCDate() + (dayOfWeek - 1),
  ));
  return WD[d.getUTCDay()];
}

function addDaysUTC(d: Date, days: number): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + days, 0, 0, 0, 0));
}

// Сносит микроциклы пользователя + их тренировки. includeScheduled=true также
// чистит личное расписание видео (ScheduledWorkout — отдельная фича календаря,
// микроциклом НЕ создаётся): нужно для «Очистить мой календарь», но НЕ для
// прогона методички (run его не трогает). История характеристик не трогается
// (FK sessionId — onDelete SetNull).
async function wipeCalendar(userId: string, opts: { includeScheduled?: boolean } = {}) {
  const mcs = await prisma.microcycle.findMany({
    where: { userId },
    select: { id: true, days: { select: { workoutSessionId: true } } },
  });
  const sessionIds = mcs
    .flatMap((m) => m.days.map((d) => d.workoutSessionId))
    .filter((x): x is string => !!x);
  const [, delSessions] = await prisma.$transaction([
    prisma.microcycle.deleteMany({ where: { userId } }),
    prisma.workoutSession.deleteMany({ where: { id: { in: sessionIds } } }),
  ]);
  let scheduled = 0;
  if (opts.includeScheduled) {
    const del = await prisma.scheduledWorkout.deleteMany({ where: { userId } });
    scheduled = del.count;
  }
  return { microcycles: mcs.length, sessions: delSessions.count, scheduled };
}

export async function POST(request: NextRequest) {
  const auth = await requireAuthUser(request);
  if ('response' in auth) return auth.response;
  if (!auth.user.isAdmin) {
    return NextResponse.json({ error: 'Только для администратора' }, { status: 403 });
  }
  const userId = auth.user.id;
  const body = await request.json().catch(() => ({}));
  const action = body?.action;

  if (action === 'clear-calendar') {
    const deleted = await wipeCalendar(userId, { includeScheduled: true });
    return NextResponse.json({
      ok: true,
      deleted,
      message: 'Календарь очищен: микроциклы, их тренировки и личное расписание видео удалены.',
    });
  }

  if (action === 'complete') {
    // Последний незакрытый цикл (без фидбэка и не в архиве).
    const mc = await prisma.microcycle.findFirst({
      where: { userId, feedback: null, status: { not: MicrocycleStatus.ARCHIVED } },
      orderBy: { cycleNumber: 'desc' },
      select: { id: true, days: { select: { workoutSessionId: true } } },
    });
    if (!mc) {
      return NextResponse.json({ error: 'Нет активного цикла для прогонки' }, { status: 404 });
    }

    const profBefore = await prisma.profile.findUnique({ where: { userId }, select: { potential: true } });
    const sessionIds = mc.days.map((d) => d.workoutSessionId).filter((x): x is string => !!x);

    // Начисляем прирост за каждую тренировку (как реальное прохождение).
    let credited = 0;
    for (const sid of sessionIds) {
      const r = await creditSessionCompletion(userId, sid, { forceVideos: true });
      if (r.credited) credited += 1;
    }

    const profAfter = await prisma.profile.findUnique({ where: { userId }, select: { potential: true } });
    const dayCount = mc.days.length || 5;
    const now = new Date();

    // «Состариваем» цикл, чтобы стал AWAITING_FEEDBACK (опрос на главной).
    // weekStartDate + dayCount должно быть в прошлом. Ловим коллизию unique
    // (userId, weekStartDate) — отодвигаем дальше.
    let applied = false;
    for (const extra of [1, 8, 15, 30]) {
      const back = addDaysUTC(now, -(dayCount + extra));
      try {
        await prisma.microcycle.update({ where: { id: mc.id }, data: { weekStartDate: back } });
        applied = true;
        break;
      } catch (e: any) {
        if (e?.code !== 'P2002') throw e;
      }
    }

    return NextResponse.json({
      ok: true,
      microcycleId: mc.id,
      creditedSessions: credited,
      potentialBefore: profBefore?.potential ?? null,
      potentialAfter: profAfter?.potential ?? null,
      aged: applied,
      message: `Цикл выполнен: начислено за ${credited} трен. Потенциал ${profBefore?.potential ?? '—'}→${profAfter?.potential ?? '—'}. ` +
        (applied ? 'Открой главную — там опросник переносимости.' : '(дату сдвинуть не удалось — опрос может не появиться).'),
    });
  }

  if (action === 'run') {
    const cycles = Math.max(1, Math.min(10, Number(body?.cycles) || 4));
    const feedback: MicrocycleFeedback =
      body?.feedback === 'NORMAL' ? MicrocycleFeedback.NORMAL
      : body?.feedback === 'HARD' ? MicrocycleFeedback.HARD
      : MicrocycleFeedback.EASY;

    // Чистый старт — воспроизводимый прогон без коллизий дат. Сносим только
    // микроциклы/сессии (личное расписание видео НЕ трогаем). Профиль/историю
    // не трогаем (прирост накопится поверх текущего потенциала).
    // NB: прогон НЕ обёрнут в одну транзакцию (generate/credit имеют свои) —
    // при сбое в середине часть циклов может остаться начисленной; повторный
    // run снова делает wipe и стартует заново, так что состояние самовосстановимо.
    await wipeCalendar(userId);

    const prof0 = await prisma.profile.findUnique({ where: { userId }, select: { potential: true } });
    if (!prof0) return NextResponse.json({ error: 'Профиль не найден' }, { status: 404 });
    const startPotential = prof0.potential;

    type CycleSnap = {
      cycleNumber: number;
      weekStart: string;
      days: { d: string; label: string }[];
      feedback: MicrocycleFeedback | null;
      creditedSessions: number;
      potentialAfter: number | null;
    };
    const timeline: CycleSnap[] = [];

    // Старт — ближайший понедельник (полная неделя Пн-Пт для чистого демо),
    // дальше +7 дней за цикл (адаптация методички видна по неделям).
    let startDate = getMicrocycleWeekStart(new Date());

    const snapDays = (weekStart: Date, days: { dayOfWeek: number; intent: MicrocycleIntent }[]) =>
      days
        .slice()
        .sort((a, b) => a.dayOfWeek - b.dayOfWeek)
        .map((d) => ({ d: weekdayShort(weekStart, d.dayOfWeek), label: labelForIntent(d.intent) }));

    for (let i = 0; i < cycles; i++) {
      const gen = await generateMicrocycleForUser(userId, { startDate });
      if (gen.status === 'NO_PROFILE') {
        return NextResponse.json({ error: 'Профиль не найден' }, { status: 404 });
      }
      const cyc = await prisma.microcycle.findUnique({
        where: { id: gen.microcycleId! },
        select: {
          id: true, cycleNumber: true, weekStartDate: true,
          days: { select: { dayOfWeek: true, intent: true, workoutSessionId: true } },
        },
      });
      if (!cyc) break;

      let credited = 0;
      for (const d of cyc.days) {
        if (!d.workoutSessionId) continue;
        const r = await creditSessionCompletion(userId, d.workoutSessionId, { forceVideos: true });
        if (r.credited) credited += 1;
      }

      await prisma.microcycle.update({
        where: { id: cyc.id },
        data: { feedback, status: MicrocycleStatus.ARCHIVED },
      });
      const profN = await prisma.profile.findUnique({ where: { userId }, select: { potential: true } });

      timeline.push({
        cycleNumber: cyc.cycleNumber,
        weekStart: cyc.weekStartDate.toISOString().slice(0, 10),
        days: snapDays(cyc.weekStartDate, cyc.days),
        feedback,
        creditedSessions: credited,
        potentialAfter: profN?.potential ?? null,
      });

      startDate = addDaysUTC(cyc.weekStartDate, 7);
    }

    // Финальный адаптированный цикл — генерим и оставляем активным для просмотра.
    let finalCycle: CycleSnap | null = null;
    const finalGen = await generateMicrocycleForUser(userId, { startDate });
    if (finalGen.microcycleId) {
      const fc = await prisma.microcycle.findUnique({
        where: { id: finalGen.microcycleId },
        select: {
          cycleNumber: true, weekStartDate: true,
          days: { select: { dayOfWeek: true, intent: true } },
        },
      });
      if (fc) {
        finalCycle = {
          cycleNumber: fc.cycleNumber,
          weekStart: fc.weekStartDate.toISOString().slice(0, 10),
          days: snapDays(fc.weekStartDate, fc.days),
          feedback: null,
          creditedSessions: 0,
          potentialAfter: null,
        };
      }
    }

    const profEnd = await prisma.profile.findUnique({ where: { userId }, select: { potential: true } });
    const finalPotential = profEnd?.potential ?? null;
    const delta = finalPotential != null ? parseFloat((finalPotential - startPotential).toFixed(1)) : null;

    return NextResponse.json({
      ok: true,
      cycles,
      feedback,
      startPotential,
      finalPotential,
      delta,
      timeline,
      finalCycle,
      message: `Прогон ${cycles} циклов (${feedback}) завершён. Потенциал ${startPotential}→${finalPotential ?? '—'} (${delta != null && delta >= 0 ? '+' : ''}${delta ?? '—'}). Активным оставлен следующий цикл.`,
    });
  }

  return NextResponse.json({ error: 'Неизвестное действие' }, { status: 400 });
}
