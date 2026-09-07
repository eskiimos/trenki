import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuthUser } from '@/lib/coach/guards';
import { logger } from '@/lib/logger';

// DELETE — удалить свой комментарий к шортсу. Автор — из httpOnly-сессии
// (раньше роут брал userId=telegramId из query: любой, кто знает чужой
// telegramId, мог удалять чужие комментарии — IDOR, см. CLAUDE.md). Админ
// может удалить любой.
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string; commentId: string }> },
) {
  const auth = await requireAuthUser(request);
  if ('response' in auth) return auth.response;
  try {
    const { id: shortId, commentId } = await context.params;
    const comment = await prisma.shortComment.findUnique({
      where: { id: commentId },
      select: { id: true, userId: true, shortId: true },
    });
    if (!comment || comment.shortId !== shortId) {
      return NextResponse.json({ error: 'Комментарий не найден' }, { status: 404 });
    }
    if (comment.userId !== auth.user.id && !auth.user.isAdmin) {
      return NextResponse.json({ error: 'Можно удалять только свои комментарии' }, { status: 403 });
    }
    await prisma.shortComment.delete({ where: { id: commentId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('short comment delete failed', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
