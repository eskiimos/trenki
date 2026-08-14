import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuthUser } from '@/lib/coach/guards';

export const dynamic = 'force-dynamic';

/**
 * GET /api/teams/my
 * Команда ТЕКУЩЕГО пользователя (взгляд атлета).
 *
 * Зачем отдельный роут: GET /api/teams защищён requireCoach и отдаёт команды,
 * СОЗДАННЫЕ тренером. Атлет получал оттуда 403, клиент молча считал, что команды
 * нет, и показывал «Вступить в команду» даже тому, кто уже в составе — выйти из
 * команды было нельзя вообще (единственная точка вызова leave не отображалась).
 *
 * Response: { team: { id, name, clubName } | null, status: 'ACTIVE' | 'PENDING' | null }
 * PENDING — заявка подана, тренер ещё не подтвердил.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuthUser(request);
  if ('response' in auth) return auth.response;

  // INVITED/PENDING считаем одним «заявка висит»; DECLINED — как будто команды нет.
  const memberships = await prisma.teamMember.findMany({
    where: { userId: auth.user.id, status: { in: ['ACTIVE', 'PENDING', 'INVITED'] } },
    orderBy: { joinedAt: 'desc' },
    select: {
      status: true,
      team: { select: { id: true, name: true, clubName: true } },
    },
  });

  // Приоритет отдаём реальному составу, а не висящей заявке. Сортировать по
  // статусу в SQL нельзя: Postgres-enum упорядочен порядком объявления, а не
  // смыслом — надёжнее выбрать в коде.
  const membership = memberships.find((m) => m.status === 'ACTIVE') ?? memberships[0];

  if (!membership) {
    return NextResponse.json({ team: null, status: null });
  }

  return NextResponse.json({
    team: membership.team,
    status: membership.status === 'ACTIVE' ? 'ACTIVE' : 'PENDING',
  });
}
