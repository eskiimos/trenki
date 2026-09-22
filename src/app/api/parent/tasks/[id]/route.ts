import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuthUser } from '@/lib/coach/guards';

export const dynamic = 'force-dynamic';

/** DELETE /api/parent/tasks/[id] — родитель отменяет своё активное задание. */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuthUser(request);
  if ('response' in auth) return auth.response;
  const { id } = await params;
  const { count } = await prisma.parentTask.updateMany({
    where: { id, parentId: auth.user.id, status: 'ACTIVE' },
    data: { status: 'CANCELED' },
  });
  if (count !== 1) return NextResponse.json({ error: 'Задание не найдено или уже закрыто' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
