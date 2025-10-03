import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// DELETE - Удалить комментарий
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string; commentId: string }> }
) {
  try {
    const { commentId } = await context.params;
    const { searchParams } = new URL(request.url);
    const telegramId = searchParams.get('userId');

    if (!telegramId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    // Находим пользователя по telegramId
    const user = await prisma.user.findUnique({
      where: { telegramId }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Проверяем, что комментарий принадлежит пользователю
    const comment = await prisma.shortComment.findUnique({
      where: { id: commentId }
    });

    if (!comment) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
    }

    if (comment.userId !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Удаляем комментарий
    await prisma.shortComment.delete({
      where: { id: commentId }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting comment:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
