import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { LoadDirection, WorkoutStatus } from '@/generated/prisma';
import { requireCoach, requireAuthUser, requireTeamOwnership } from '@/lib/coach/guards';
import { sendUserPush } from '@/lib/coach/push';
import { getPaywallMode } from '@/lib/settings';
import { isPaywalled } from '@/lib/paywall';

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
/**
 * Порядок модулей в полноценной 4-модульной тренировке.
 * Соответствует ModuleType: WARMUP → FITNESS → TECHNIQUE → COOLDOWN.
 */
const FULL_MODULE_SLOTS = ['warmup', 'fitness', 'technique', 'cooldown'] as const;
type FullModuleSlot = (typeof FULL_MODULE_SLOTS)[number];

export async function POST(request: NextRequest) {
  const auth = await requireCoach(request);
  if ('response' in auth) return auth.response;

  const body = await request.json().catch(() => ({}));
  const teamId = String(body?.teamId || '').trim();
  const dueDate = body?.dueDate ? new Date(body.dueDate) : null;
  const notes = body?.notes ? String(body.notes).trim() : null;
  const athleteIds: string[] = Array.isArray(body?.athleteIds) ? body.athleteIds : [];
  const force = Boolean(body?.force);

  // mode === 'full' → составная тренировка из 2-4 модулей (тренер может
  // пропустить любую часть, напр. разминка + техника + заминка без физ.).
  // По умолчанию — одиночное видео.
  const mode: 'single' | 'full' = body?.mode === 'full' ? 'full' : 'single';
  const singleVideoId = String(body?.videoId || '').trim();
  const moduleVideos: Partial<Record<FullModuleSlot, string>> =
    typeof body?.moduleVideos === 'object' && body.moduleVideos
      ? body.moduleVideos
      : {};
  // В каноническом порядке (warmup → fitness → technique → cooldown)
  // оставляем только реально выбранные модули.
  const orderedFullVideoIds: string[] = FULL_MODULE_SLOTS
    .map((slot) => String(moduleVideos[slot] || '').trim())
    .filter((v) => v.length > 0);

  if (!teamId || !dueDate || Number.isNaN(dueDate.getTime()) || athleteIds.length === 0) {
    return NextResponse.json({ error: 'Не все поля заполнены' }, { status: 400 });
  }

  if (mode === 'single' && !singleVideoId) {
    return NextResponse.json({ error: 'Не выбрано видео' }, { status: 400 });
  }

  if (mode === 'full' && (orderedFullVideoIds.length < 2 || orderedFullVideoIds.length > 4)) {
    return NextResponse.json(
      { error: 'Полноценное занятие требует от 2 до 4 модулей' },
      { status: 400 },
    );
  }

  const owns = await requireTeamOwnership(auth.user.id, teamId);
  if (!owns) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const selfFiltered = athleteIds.filter((id) => id !== auth.user.id);
  if (selfFiltered.length === 0) {
    return NextResponse.json({ error: 'Нельзя назначить задание самому себе' }, { status: 400 });
  }

  const members = await prisma.teamMember.findMany({
    where: { teamId, status: 'ACTIVE', userId: { in: selfFiltered } },
    select: {
      userId: true,
      user: {
        select: { firstName: true, lastName: true, accessTier: true, premiumUntil: true, isAdmin: true },
      },
    },
  });
  const validIds = new Set(members.map((m) => m.userId));
  const memberById = new Map(members.map((m) => [m.userId, m.user] as const));
  const filtered = selfFiltered.filter((id) => validIds.has(id));
  if (filtered.length === 0) {
    return NextResponse.json({ error: 'Игроки не найдены в команде' }, { status: 400 });
  }

  // Задания — платная фича атлета (Трек A, п.6g): выдавать можно только игрокам с
  // подпиской. В режиме paywall 'off' isPaywalled=false у всех → пропускаем (как раньше);
  // при 'admins'/'on' — отклоняем всю выдачу, называя игроков без подписки (клиент их
  // и так дизейблит в пикере, это серверная защита от обхода).
  const paywallMode = await getPaywallMode();
  const blockedNames = filtered
    .map((id) => memberById.get(id))
    .filter((u): u is NonNullable<typeof u> => !!u && isPaywalled(u, paywallMode))
    .map((u) => `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || 'игрок');
  if (blockedNames.length > 0) {
    return NextResponse.json(
      {
        error: `Задание можно давать только игрокам с подпиской. Без подписки: ${blockedNames.join(', ')}`,
        code: 'ATHLETE_SUBSCRIPTION_REQUIRED',
      },
      { status: 402 },
    );
  }

  // Проверяем существование всех видео (в зависимости от режима)
  const allVideoIds = mode === 'full' ? orderedFullVideoIds : [singleVideoId];
  const videos = await prisma.video.findMany({
    where: { id: { in: allVideoIds } },
    select: { id: true, duration: true, rpeMin: true, rpeMax: true },
  });
  if (videos.length !== allVideoIds.length) {
    return NextResponse.json({ error: 'Одно или несколько видео не найдено' }, { status: 404 });
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

  let created: Array<{ id: string }> = [];

  if (mode === 'single') {
    created = await prisma.$transaction(
      filtered.map((athleteId) =>
        prisma.trainingAssignment.create({
          data: {
            coachId: auth.user.id,
            athleteId,
            teamId,
            videoId: singleVideoId,
            dueDate,
            notes,
            status: 'PENDING',
          },
          select: { id: true },
        })
      )
    );
  } else {
    // Полноценное 4-модульное задание: для каждого атлета создаём WorkoutSession
    // с 4 WorkoutSessionVideo (в фиксированном порядке) + TrainingAssignment,
    // связанный с этой сессией через workoutSessionId.
    const videoById = new Map(videos.map((v) => [v.id, v] as const));
    const totalDurationSec = orderedFullVideoIds.reduce(
      (sum, vid) => sum + (videoById.get(vid)?.duration ?? 0),
      0,
    );
    const targetDurationMin = Math.max(1, Math.round(totalDurationSec / 60));
    // Усреднённый RPE по 4 модулям (с границами 1..10).
    const avgRpe = Math.max(
      1,
      Math.min(
        10,
        Math.round(
          orderedFullVideoIds.reduce((sum, vid) => {
            const v = videoById.get(vid);
            return sum + ((v?.rpeMin ?? 5) + (v?.rpeMax ?? 7)) / 2;
          }, 0) / orderedFullVideoIds.length,
        ),
      ),
    );

    created = await prisma.$transaction(async (tx) => {
      const result: Array<{ id: string }> = [];
      for (const athleteId of filtered) {
        const session = await tx.workoutSession.create({
          data: {
            userId: athleteId,
            coachId: auth.user.id,
            targetDuration: targetDurationMin,
            targetRPE: avgRpe,
            loadDirection: LoadDirection.MEDIUM,
            status: WorkoutStatus.PENDING,
            totalVideos: orderedFullVideoIds.length,
            videos: {
              create: orderedFullVideoIds.map((vid, idx) => ({
                videoId: vid,
                order: idx,
              })),
            },
          },
          select: { id: true },
        });
        const assignment = await tx.trainingAssignment.create({
          data: {
            coachId: auth.user.id,
            athleteId,
            teamId,
            workoutSessionId: session.id,
            dueDate,
            notes,
            status: 'PENDING',
          },
          select: { id: true },
        });
        result.push(assignment);
      }
      return result;
    });
  }

  // Уведомления игрокам — только web-push (PWA). Telegram временно
  // отключён, см. CLAUDE.md. Не блокируем ответ тренеру.
  const coachName = `${auth.user.firstName ?? ''} ${auth.user.lastName ?? ''}`.trim() || 'Тренер';
  Promise.allSettled(
    filtered.map((athleteId) =>
      sendUserPush(athleteId, {
        title: 'Новое задание от тренера',
        body: `${coachName} назначил тебе тренировку`,
        url: '/profile/assignments',
      }),
    ),
  ).catch(() => { });

  return NextResponse.json({ created: created.length, assignments: created });
}
