import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuthUser } from '@/lib/coach/guards';

// DELETE - Удалить свой комментарий к видео.
// Владельца определяем ТОЛЬКО по сессии (requireAuthUser), а не по
// userId/telegramId из query — старый шортс-роут так делал, это IDOR.
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string; commentId: string }> }
) {
  try {
    const auth = await requireAuthUser(request);
    if ('response' in auth) return auth.response;
    const userId = auth.user.id;

    const { commentId } = await context.params;

    // Проверяем, что комментарий существует и принадлежит пользователю
    const comment = await prisma.videoComment.findUnique({
      where: { id: commentId }
    });

    if (!comment) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
    }

    if (comment.userId !== userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    await prisma.videoComment.delete({
      where: { id: commentId }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting video comment:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
