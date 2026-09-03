import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuthUser } from '@/lib/coach/guards';
import { workoutTitle } from '@/lib/training/workout-title';
import { goalsFromStoredDays } from '@/lib/microcycle/week-plan';

/**
 * Избранные тренировки целиком (составленные ИИ).
 *  GET    — список избранных текущего юзера (+ названия модулей для превью).
 *  POST   — { sessionId } добавить тренировку из сессии (снапшот состава).
 *  DELETE — ?id=... удалить из избранного.
 * Auth: httpOnly session; доступ только к своим записям.
 */
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await requireAuthUser(request);
  if ('response' in auth) return auth.response;

  const items = await prisma.favoriteWorkout.findMany({
    where: { userId: auth.user.id },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  // Названия/обложки модулей для превью карточки (по снапшоту videoIds).
  const allIds = Array.from(new Set(items.flatMap((i) => i.videoIds)));
  const videos = allIds.length
    ? await prisma.video.findMany({
        where: { id: { in: allIds } },
        select: { id: true, title: true, thumbnail: true, duration: true },
      })
    : [];
  const byId = new Map(videos.map((v) => [v.id, v]));

  return NextResponse.json({
    workouts: items.map((i) => {
      const mods = i.videoIds.map((id) => byId.get(id)).filter(Boolean);
      return {
        id: i.id,
        title: i.title,
        goal: i.goal,
        energyState: i.energyState,
        createdAt: i.createdAt,
        videoIds: i.videoIds,
        modules: mods.map((m) => ({ id: m!.id, title: m!.title, thumbnail: m!.thumbnail })),
        // Часть роликов могла быть удалена из каталога — показываем честно.
        missingCount: i.videoIds.length - mods.length,
        totalDuration: mods.reduce((s, m) => s + (m!.duration || 0), 0),
      };
    }),
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireAuthUser(request);
  if ('response' in auth) return auth.response;

  const body = await request.json().catch(() => ({}));
  const sessionId = String(body?.sessionId || '').trim();
  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId обязателен' }, { status: 400 });
  }

  const session = await prisma.workoutSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      userId: true,
      goal: true,
      energyState: true,
      coachId: true,
      videos: { orderBy: { order: 'asc' }, select: { videoId: true } },
      microcycleDay: {
        select: {
          dayOfWeek: true,
          microcycle: {
            select: { cycleNumber: true, days: { select: { dayOfWeek: true, intent: true } } },
          },
        },
      },
    },
  });
  if (!session) return NextResponse.json({ error: 'Тренировка не найдена' }, { status: 404 });
  if (session.userId !== auth.user.id) {
    return NextResponse.json({ error: 'Доступ запрещён' }, { status: 403 });
  }

  // Название — как в /api/profile/history (клиентскому title не доверяем):
  // у цикловых goal/energyState пусты, и без этого несколько сохранённых дней
  // цикла превращались в неотличимые «Тренировка от ИИ-тренера».
  let title = workoutTitle(session.goal, session.energyState);
  let goal = session.goal;
  const mday = session.microcycleDay;
  if (mday?.microcycle && !session.goal) {
    const plans = goalsFromStoredDays(
      mday.microcycle.days.map((d) => ({ dayOfWeek: d.dayOfWeek, intent: d.intent })),
      mday.microcycle.cycleNumber,
    );
    const plan = plans.find((p) => p.dayOfWeek === mday.dayOfWeek);
    if (plan) {
      // Цель дня цикла восстанавливается из intent + номера цикла (как в
      // ачивках) — правка владельца «в избранном для трени из цикла добавить цель».
      goal = plan.goal;
      title = `${workoutTitle(plan.goal, null)} · ${plan.label} · Цикл №${mday.microcycle.cycleNumber}`;
    }
  } else if (!mday && session.coachId) {
    title = 'Задание от тренера';
  }

  const videoIds = session.videos.map((v) => v.videoId);
  if (videoIds.length === 0) {
    return NextResponse.json({ error: 'В тренировке нет модулей' }, { status: 400 });
  }

  // Повторное добавление той же сессии — не плодим дубли.
  const existing = await prisma.favoriteWorkout.findFirst({
    where: { userId: auth.user.id, sourceSessionId: sessionId },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json({ workout: { id: existing.id }, alreadyExists: true });
  }

  try {
    const created = await prisma.favoriteWorkout.create({
      data: {
        userId: auth.user.id,
        title,
        goal,
        energyState: session.energyState,
        videoIds,
        sourceSessionId: sessionId,
      },
      select: { id: true, title: true },
    });
    return NextResponse.json({ workout: created });
  } catch (e: unknown) {
    // Гонка дабл-тапа: параллельный POST успел создать запись между findFirst
    // и create — уникальный индекс (userId, sourceSessionId) вернул P2002.
    // Отдаём существующую, как в ветке alreadyExists.
    if (e && typeof e === 'object' && (e as { code?: string }).code === 'P2002') {
      const dup = await prisma.favoriteWorkout.findFirst({
        where: { userId: auth.user.id, sourceSessionId: sessionId },
        select: { id: true },
      });
      if (dup) return NextResponse.json({ workout: { id: dup.id }, alreadyExists: true });
    }
    throw e;
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAuthUser(request);
  if ('response' in auth) return auth.response;

  const id = request.nextUrl.searchParams.get('id') ?? '';
  if (!id) return NextResponse.json({ error: 'id обязателен' }, { status: 400 });

  // deleteMany с userId — чужую запись удалить нельзя.
  const res = await prisma.favoriteWorkout.deleteMany({ where: { id, userId: auth.user.id } });
  if (res.count === 0) return NextResponse.json({ error: 'Не найдено' }, { status: 404 });

  return NextResponse.json({ success: true });
}
