// Погашение родительского инвайта: POST { code } от АВТОРИЗОВАННОГО юзера
// (родителя). Валидирует код, создаёт ParentLink и — только для свежего
// аккаунта без атлетской жизни — переводит роль в PARENT.

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuthUser } from '@/lib/coach/guards';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const auth = await requireAuthUser(request);
  if ('response' in auth) return auth.response;
  const user = auth.user;

  try {
    const body = await request.json().catch(() => ({}));
    const code = String(body.code || '').trim().toLowerCase();
    if (!/^[0-9a-f]{8}$/.test(code)) {
      return NextResponse.json({ error: 'Неверный формат кода' }, { status: 400 });
    }

    const invite = await prisma.parentInvite.findUnique({ where: { code } });
    if (!invite) {
      return NextResponse.json({ error: 'Ссылка не найдена. Попроси ребёнка прислать новую.' }, { status: 404 });
    }
    if (invite.usedAt) {
      return NextResponse.json({ error: 'Ссылка уже использована. Попроси ребёнка создать новую.' }, { status: 400 });
    }
    if (invite.expiresAt < new Date()) {
      return NextResponse.json({ error: 'Срок действия ссылки истёк. Попроси ребёнка создать новую.' }, { status: 400 });
    }
    if (invite.childId === user.id) {
      return NextResponse.json({ error: 'Нельзя привязать аккаунт к самому себе' }, { status: 400 });
    }

    // Гасим код атомарно (updateMany + usedAt=null): два одновременных запроса
    // с одним кодом не создадут две привязки к разным родителям.
    const claimed = await prisma.parentInvite.updateMany({
      where: { id: invite.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (claimed.count === 0) {
      return NextResponse.json({ error: 'Ссылка уже использована. Попроси ребёнка создать новую.' }, { status: 400 });
    }

    // upsert по unique(parentId, childId): повторное погашение той же парой —
    // идемпотентно, дубликата связи не будет.
    await prisma.parentLink.upsert({
      where: { parentId_childId: { parentId: user.id, childId: invite.childId } },
      create: { parentId: user.id, childId: invite.childId },
      update: {},
    });

    // Роль → PARENT только для «пустого» атлета (аккаунт создан только что под
    // родителя: ни профиля, ни тренировок). Атлет с историей остаётся атлетом —
    // родитель-атлет тоже валиден, связь уже создана.
    let role = user.role;
    if (user.role === 'ATHLETE') {
      const [profile, workoutCount, sessionCount] = await Promise.all([
        prisma.profile.findUnique({ where: { userId: user.id }, select: { id: true } }),
        prisma.workoutSession.count({ where: { userId: user.id } }),
        prisma.trainingSession.count({ where: { userId: user.id } }),
      ]);
      if (!profile && workoutCount === 0 && sessionCount === 0) {
        await prisma.user.update({ where: { id: user.id }, data: { role: 'PARENT' } });
        role = 'PARENT';
      }
    }

    logger.info('parent invite redeemed', { userId: user.id, role });
    return NextResponse.json({ success: true, role });
  } catch (error) {
    logger.error('parent join failed', error);
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 });
  }
}
