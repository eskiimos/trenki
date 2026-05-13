import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireCoach } from '@/lib/coach/guards';
import { generateInviteCode } from '@/lib/coach/invite-code';

export const dynamic = 'force-dynamic';

/**
 * GET /api/teams
 * Возвращает список команд текущего тренера.
 */
export async function GET(request: NextRequest) {
  const auth = await requireCoach(request);
  if ('response' in auth) return auth.response;

  const teams = await prisma.team.findMany({
    where: { createdBy: auth.user.id },
    orderBy: { createdAt: 'asc' },
    include: {
      _count: { select: { members: true } },
    },
  });

  return NextResponse.json({
    teams: teams.map((t) => ({
      id: t.id,
      name: t.name,
      clubName: t.clubName,
      logoUrl: t.logoUrl,
      inviteCode: t.inviteCode,
      membersCount: t._count.members,
      createdAt: t.createdAt,
    })),
  });
}

/**
 * POST /api/teams
 * Body: { name: string, clubName?: string, logoUrl?: string }
 * Создаёт новую команду. Тренер становится её владельцем.
 */
export async function POST(request: NextRequest) {
  const auth = await requireCoach(request);
  if ('response' in auth) return auth.response;

  const body = await request.json().catch(() => ({}));
  const name = String(body?.name || '').trim();
  const clubName = body?.clubName ? String(body.clubName).trim() : null;
  const logoUrl = body?.logoUrl ? String(body.logoUrl).trim() : null;

  if (!name) {
    return NextResponse.json({ error: 'Название команды обязательно' }, { status: 400 });
  }

  // Генерируем уникальный код (с защитой от коллизии)
  let inviteCode = generateInviteCode();
  for (let i = 0; i < 5; i += 1) {
    const exists = await prisma.team.findUnique({ where: { inviteCode } });
    if (!exists) break;
    inviteCode = generateInviteCode();
  }

  const team = await prisma.team.create({
    data: {
      name,
      clubName,
      logoUrl,
      inviteCode,
      createdBy: auth.user.id,
    },
  });

  return NextResponse.json({
    success: true,
    team: {
      id: team.id,
      name: team.name,
      clubName: team.clubName,
      logoUrl: team.logoUrl,
      inviteCode: team.inviteCode,
      createdAt: team.createdAt,
    },
  });
}
