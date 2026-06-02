import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireCoach, requireAuthUser, requireTeamOwnership } from '@/lib/coach/guards';
import { sendUserPush } from '@/lib/coach/push';

export const dynamic = 'force-dynamic';

/**
 * GET /api/assignments
 * Query: ?role=coach|athlete (default: athlete)
 *   coach   — список заданий, выданных текущим тренером (его команд)
 *   athlete — список заданий, назначенных текущему игроку
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuthUser(request);
  if ('response' in auth) return auth.response;

  const role = request.nextUrl.searchParams.get('role') ?? 'athlete';

  if (role === 'coach') {
    if (auth.user.role !== 'COACH') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const list = await prisma.trainingAssignment.findMany({
      where: { coachId: auth.user.id },
      orderBy: { assignedAt: 'desc' },
      take: 100,
      include: {
        athlete: { select: { id: true, firstName: true, lastName: true } },
        video: { select: { id: true, title: true, thumbnail: true, duration: true } },
        team: { select: { id: true, name: true } },
      },
    });
    return NextResponse.json({ assignments: list });
  }

  const list = await prisma.trainingAssignment.findMany({
    where: { athleteId: auth.user.id },
    orderBy: [{ status: 'asc' }, { dueDate: 'asc' }],
    take: 100,
    include: {
      coach: { select: { id: true, firstName: true, lastName: true } },
      video: { select: { id: true, title: true, thumbnail: true, duration: true } },
      team: { select: { id: true, name: true } },
    },
  });
  return NextResponse.json({ assignments: list });
}

/**
 * POST /api/assignments
 * Body: { teamId, videoId, dueDate, notes?, athleteIds: string[] }
 * Создаёт задание (одно или несколько — по одному на каждого игрока).
 */
export async function POST(request: NextRequest) {
  const auth = await requireCoach(request);
  if ('response' in auth) return auth.response;

  const body = await request.json().catch(() => ({}));
  const teamId = String(body?.teamId || '').trim();
  const videoId = String(body?.videoId || '').trim();
  const dueDate = body?.dueDate ? new Date(body.dueDate) : null;
  const notes = body?.notes ? String(body.notes).trim() : null;
  const athleteIds: string[] = Array.isArray(body?.athleteIds) ? body.athleteIds : [];
  const force = Boolean(body?.force);

  if (!teamId || !videoId || !dueDate || Number.isNaN(dueDate.getTime()) || athleteIds.length === 0) {
    return NextResponse.json({ error: 'Не все поля заполнены' }, { status: 400 });
  }

  const owns = await requireTeamOwnership(auth.user.id, teamId);
  if (!owns) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Защита: тренер не может назначить задание самому себе
  const selfFiltered = athleteIds.filter((id) => id !== auth.user.id);
  if (selfFiltered.length === 0) {
    return NextResponse.json({ error: 'Нельзя назначить задание самому себе' }, { status: 400 });
  }

  // Проверяем, что все указанные athleteIds — действительно члены команды
  const members = await prisma.teamMember.findMany({
    where: { teamId, status: 'ACTIVE', userId: { in: selfFiltered } },
    select: {
      userId: true,
      user: { select: { firstName: true, lastName: true } },
    },
  });
  const validIds = new Set(members.map((m) => m.userId));
  const memberById = new Map(members.map((m) => [m.userId, m.user] as const));
  const filtered = selfFiltered.filter((id) => validIds.has(id));
  if (filtered.length === 0) {
    return NextResponse.json({ error: 'Игроки не найдены в команде' }, { status: 400 });
  }

  // Проверяем существование видео
  const video = await prisma.video.findUnique({ where: { id: videoId }, select: { id: true } });
  if (!video) {
    return NextResponse.json({ error: 'Видео не найдено' }, { status: 404 });
  }

  // Конфликт-чек: если у атлета на дату dueDate уже есть план Марка
  // (ScheduledWorkout), календарь атлета спрячет тренерское назначение.
  // Возвращаем warnings и ждём подтверждения force=true.
  if (!force) {
    const dayStart = new Date(dueDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dueDate);
    dayEnd.setHours(23, 59, 59, 999);

    const conflicts = await prisma.scheduledWorkout.findMany({
      where: {
        userId: { in: filtered },
        date: { gte: dayStart, lte: dayEnd },
      },
      select: {
        id: true,
        userId: true,
        video: { select: { id: true, title: true } },
      },
    });

    if (conflicts.length > 0) {
      return NextResponse.json({
        created: 0,
        assignments: [],
        warnings: conflicts.map((c) => {
          const u = memberById.get(c.userId);
          const athleteName = `${u?.firstName ?? ''} ${u?.lastName ?? ''}`.trim() || 'Игрок';
          return {
            athleteId: c.userId,
            athleteName,
            scheduledWorkoutId: c.id,
            videoTitle: c.video.title,
          };
        }),
      });
    }
  }

  const created = await prisma.$transaction(
    filtered.map((athleteId) =>
      prisma.trainingAssignment.create({
        data: {
          coachId: auth.user.id,
          athleteId,
          teamId,
          videoId,
          dueDate,
          notes,
          status: 'PENDING',
        },
      })
    )
  );

  // Push-уведомления игрокам — не блокируем ответ
  const coachName = `${auth.user.firstName ?? ''} ${auth.user.lastName ?? ''}`.trim() || 'Тренер';
  Promise.allSettled(
    filtered.map((athleteId) =>
      sendUserPush(athleteId, {
        title: 'Новое задание от тренера',
        body: `${coachName} назначил тебе тренировку`,
        url: '/profile/assignments',
      })
    )
  ).catch(() => { });

  return NextResponse.json({ created: created.length, assignments: created });
}
