import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuthUser } from '@/lib/coach/guards';
import { isValidInviteCodeFormat } from '@/lib/coach/invite-code';
import { rateLimit } from '@/lib/coach/rate-limit';

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

  // Идемпотентно: если уже состоит — просто возвращаем команду
  const existing = await prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId: team.id, userId: auth.user.id } },
  });

  if (existing) {
    if (existing.status !== 'ACTIVE') {
      await prisma.teamMember.update({
        where: { id: existing.id },
        data: { status: 'ACTIVE' },
      });
    }
    return NextResponse.json({ team: { id: team.id, name: team.name } });
  }

  await prisma.teamMember.create({
    data: {
      teamId: team.id,
      userId: auth.user.id,
      role: 'PLAYER',
      status: 'ACTIVE',
    },
  });

  return NextResponse.json({ team: { id: team.id, name: team.name } });
}
