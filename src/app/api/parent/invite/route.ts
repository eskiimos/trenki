// Инвайты «пригласи родителя» (генерирует РЕБЁНОК-атлет из профиля):
//   POST   — создать новый код (старые неиспользованные деактивируются);
//   GET    — активный инвайт + список привязанных родителей (с unlinkRequestedAt);
//   DELETE — 410: мгновенная отвязка ребёнком убрана, теперь только запрос
//            через POST /api/parent/unlink-request (родитель подтверждает).
// Код одноразовый, живёт 48 часов. Погашение — POST /api/parent/join.

import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuthUser } from '@/lib/coach/guards';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const INVITE_TTL_MS = 48 * 60 * 60 * 1000; // 48 часов

function inviteUrl(code: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL?.trim() || 'https://trenki.app';
  return `${base.replace(/\/$/, '')}/parent/join?code=${code}`;
}

export async function POST(request: NextRequest) {
  const auth = await requireAuthUser(request);
  if ('response' in auth) return auth.response;
  const user = auth.user;

  if (user.role !== 'ATHLETE') {
    return NextResponse.json(
      { error: 'Приглашать родителей может только спортсмен' },
      { status: 403 },
    );
  }

  try {
    // Прежние неиспользованные коды гасим (истекают «сейчас») — активен всегда
    // максимум один код на ребёнка.
    await prisma.parentInvite.updateMany({
      where: { childId: user.id, usedAt: null },
      data: { expiresAt: new Date() },
    });

    const code = crypto.randomBytes(4).toString('hex'); // 8 hex-символов
    const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
    await prisma.parentInvite.create({
      data: { code, childId: user.id, expiresAt },
    });

    logger.info('parent invite created', { userId: user.id });
    return NextResponse.json({ code, url: inviteUrl(code), expiresAt });
  } catch (error) {
    logger.error('parent invite create failed', error);
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const auth = await requireAuthUser(request);
  if ('response' in auth) return auth.response;
  const userId = auth.user.id;

  try {
    const [invite, links] = await Promise.all([
      prisma.parentInvite.findFirst({
        where: { childId: userId, usedAt: null, expiresAt: { gt: new Date() } },
        orderBy: { createdAt: 'desc' },
        select: { code: true, expiresAt: true },
      }),
      prisma.parentLink.findMany({
        where: { childId: userId },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          unlinkRequestedAt: true,
          parent: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      }),
    ]);

    return NextResponse.json({
      invite: invite
        ? { code: invite.code, url: inviteUrl(invite.code), expiresAt: invite.expiresAt }
        : null,
      parents: links.map((l) => ({
        linkId: l.id,
        id: l.parent.id,
        firstName: l.parent.firstName,
        lastName: l.parent.lastName,
        email: l.parent.email,
        unlinkRequestedAt: l.unlinkRequestedAt,
      })),
    });
  } catch (error) {
    logger.error('parent invite fetch failed', error);
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 });
  }
}

// Мгновенная отвязка ребёнком УБРАНА (решение владельца): ребёнок только
// запрашивает отвязку (POST /api/parent/unlink-request), связь рвёт родитель
// в кабинете. Старым клиентам отвечаем 410, чтобы не молчать.
export async function DELETE() {
  return NextResponse.json(
    {
      error:
        'Отвязка ребёнком отключена. Отправь запрос — родитель подтвердит его в своём кабинете.',
    },
    { status: 410 },
  );
}
