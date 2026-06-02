import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuthUser } from '@/lib/coach/guards';
import { isValidInviteCodeFormat } from '@/lib/coach/invite-code';
import { rateLimit } from '@/lib/coach/rate-limit';
import { sendUserPush } from '@/lib/coach/push';

export const dynamic = 'force-dynamic';

/**
 * POST /api/teams/join
 * Body: { code: string }
 * Игрок-атлет присоединяется к команде по invite-коду.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuthUser(request);
  if ('response' in auth) return auth.response;

  // Защита от перебора: 10 попыток в минуту на пользователя
  const rl = rateLimit(`join:${auth.user.id}`, 10, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Слишком много попыток. Попробуй позже.' },
      { status: 429 }
    );
  }

  if (auth.user.role === 'COACH') {
    return NextResponse.json({ error: 'Тренер не может вступать в команду' }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const code = String(body?.code || '').trim().toUpperCase();
  if (!isValidInviteCodeFormat(code)) {
    return NextResponse.json({ error: 'Неверный формат кода' }, { status: 400 });
  }

  const team = await prisma.team.findUnique({ where: { inviteCode: code } });
  if (!team) {
    return NextResponse.json({ error: 'Команда не найдена' }, { status: 404 });
  }

  // Идемпотентно: повторный join не плодит записи.
  // - ACTIVE → возвращаем сразу (уже в команде).
  // - PENDING/INVITED → возвращаем как pending (заявка уже ждёт подтверждения).
  // - DECLINED → создаём новую заявку (re-apply) — обновляем статус на PENDING.
  const existing = await prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId: team.id, userId: auth.user.id } },
  });

  if (existing) {
    if (existing.status === 'ACTIVE') {
      return NextResponse.json({ team: { id: team.id, name: team.name }, status: 'ACTIVE' });
    }
    if (existing.status === 'PENDING' || existing.status === 'INVITED') {
      return NextResponse.json({ team: { id: team.id, name: team.name }, status: 'PENDING' });
    }
    // DECLINED — повторная заявка
    await prisma.teamMember.update({
      where: { id: existing.id },
      data: { status: 'PENDING', joinedAt: new Date() },
    });
  } else {
    await prisma.teamMember.create({
      data: {
        teamId: team.id,
        userId: auth.user.id,
        role: 'PLAYER',
        status: 'PENDING',
      },
    });
  }

  // Уведомляем тренера о новой заявке — не блокируем ответ.
  const athleteName =
    `${auth.user.firstName ?? ''} ${auth.user.lastName ?? ''}`.trim() ||
    auth.user.email ||
    'Игрок';
  sendUserPush(team.createdBy, {
    title: 'Заявка в команду',
    body: `${athleteName} хочет вступить в «${team.name}»`,
    url: '/coach/team',
  }).catch(() => { });

  return NextResponse.json({ team: { id: team.id, name: team.name }, status: 'PENDING' });
}
