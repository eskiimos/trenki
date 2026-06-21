import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireCoach, requireTeamOwnership } from '@/lib/coach/guards';

// GET /api/coach/athlete-activity?teamId=X&athleteIds=a,b,c
// Данные для выдачи ДЗ — подсветка «уже делал»:
//   completed    — { videoId: { count, lastDate } }: сколько ИЗ ВЫБРАННЫХ
//                  атлетов уже выполняли это видео и когда в последний раз;
//   teamAssigned — { videoId: lastDate }: какие видео уже давались этой команде
//                  (для режима «вся команда»).
// Доступ: только тренер-владелец команды; атлеты фильтруются по членству в ней
// (IDOR-защита — нельзя смотреть чужих, ср. coach-view).
export async function GET(request: NextRequest) {
  const auth = await requireCoach(request);
  if ('response' in auth) return auth.response;
  const coachId = auth.user.id;

  const { searchParams } = new URL(request.url);
  const teamId = (searchParams.get('teamId') || '').trim();
  const athleteIds = (searchParams.get('athleteIds') || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (!teamId) {
    return NextResponse.json({ error: 'teamId required' }, { status: 400 });
  }
  const owns = await requireTeamOwnership(coachId, teamId);
  if (!owns) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Оставляем только атлетов, реально состоящих в этой команде.
  let validAthleteIds: string[] = [];
  if (athleteIds.length) {
    const members = await prisma.teamMember.findMany({
      where: { teamId, userId: { in: athleteIds } },
      select: { userId: true },
    });
    validAthleteIds = members.map((m) => m.userId);
  }

  // Выполненные видео по выбранным атлетам (completed + дата последнего раза).
  const completed: Record<string, { count: number; lastDate: string }> = {};
  if (validAthleteIds.length) {
    const done = await prisma.workoutSessionVideo.findMany({
      where: {
        completed: true,
        completedAt: { not: null },
        session: { userId: { in: validAthleteIds } },
      },
      select: { videoId: true, completedAt: true, session: { select: { userId: true } } },
    });
    const agg: Record<string, { athletes: Set<string>; last: Date }> = {};
    for (const d of done) {
      if (!d.completedAt) continue;
      const a = agg[d.videoId] || (agg[d.videoId] = { athletes: new Set<string>(), last: d.completedAt });
      a.athletes.add(d.session.userId);
      if (d.completedAt > a.last) a.last = d.completedAt;
    }
    for (const [vid, a] of Object.entries(agg)) {
      completed[vid] = { count: a.athletes.size, lastDate: a.last.toISOString() };
    }
  }

  // Что уже давалось этой команде (для режима «вся команда»).
  const teamAssigned: Record<string, string> = {};
  const assigns = await prisma.trainingAssignment.findMany({
    where: { coachId, teamId, videoId: { not: null } },
    select: { videoId: true, assignedAt: true },
  });
  for (const row of assigns) {
    if (!row.videoId) continue;
    const prev = teamAssigned[row.videoId];
    if (!prev || new Date(prev).getTime() < row.assignedAt.getTime()) {
      teamAssigned[row.videoId] = row.assignedAt.toISOString();
    }
  }

  return NextResponse.json({ selectedCount: validAthleteIds.length, completed, teamAssigned });
}
