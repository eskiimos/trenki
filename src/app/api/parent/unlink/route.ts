// Управление отвязкой со стороны РОДИТЕЛЯ (POST {linkId, action}):
//   confirm — подтвердить запрос ребёнка → связь удаляется
//             (только если запрос действительно есть, unlinkRequestedAt != null);
//   decline — отклонить запрос ребёнка → unlinkRequestedAt = null;
//   unlink  — родитель отвязывается сам, без запроса → связь удаляется.
// Запрос ребёнка создаётся в POST /api/parent/unlink-request.

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuthUser } from '@/lib/coach/guards';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const ACTIONS = ['confirm', 'decline', 'unlink'] as const;
type Action = (typeof ACTIONS)[number];

export async function POST(request: NextRequest) {
  const auth = await requireAuthUser(request);
  if ('response' in auth) return auth.response;
  const userId = auth.user.id;

  const body = await request.json().catch(() => ({}));
  const linkId = typeof body.linkId === 'string' ? body.linkId : '';
  const action = body.action as Action;
  if (!linkId || !ACTIONS.includes(action)) {
    return NextResponse.json(
      { error: 'linkId и action (confirm|decline|unlink) обязательны' },
      { status: 400 },
    );
  }

  try {
    // Все ветки — *Many с parentId=я: чужую связь тронуть нельзя (не IDOR).
    if (action === 'confirm') {
      // Подтверждение имеет смысл только при живом запросе ребёнка.
      const result = await prisma.parentLink.deleteMany({
        where: { id: linkId, parentId: userId, unlinkRequestedAt: { not: null } },
      });
      if (result.count === 0) {
        return NextResponse.json({ error: 'Запрос на отвязку не найден' }, { status: 404 });
      }
      logger.info('unlink confirmed by parent', { userId, linkId });
      return NextResponse.json({ success: true });
    }

    if (action === 'decline') {
      const result = await prisma.parentLink.updateMany({
        where: { id: linkId, parentId: userId, unlinkRequestedAt: { not: null } },
        data: { unlinkRequestedAt: null },
      });
      if (result.count === 0) {
        return NextResponse.json({ error: 'Запрос на отвязку не найден' }, { status: 404 });
      }
      logger.info('unlink declined by parent', { userId, linkId });
      return NextResponse.json({ success: true });
    }

    // action === 'unlink': родитель рвёт связь сам, запрос ребёнка не нужен.
    const result = await prisma.parentLink.deleteMany({
      where: { id: linkId, parentId: userId },
    });
    if (result.count === 0) {
      return NextResponse.json({ error: 'Связь не найдена' }, { status: 404 });
    }
    logger.info('parent link removed by parent', { userId, linkId });
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('parent unlink failed', error);
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 });
  }
}
