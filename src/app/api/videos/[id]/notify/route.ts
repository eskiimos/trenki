import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAsync } from '@/lib/admin-session';
import { prisma } from '@/lib/prisma';
import { broadcastPush } from '@/lib/coach/push';

// POST /api/videos/[id]/notify — рассылка push «доступно новое видео» всем
// атлетам. Только из админки (кнопка «Опубликовать для атлетов»). Защита от
// повторной рассылки: если athletesNotifiedAt уже стоит — 409, если только не
// передан { force: true }.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await requireAdminAsync(request);
  if (denied) return denied;

  const { id } = await params;
  const force = await request
    .json()
    .then((b) => !!b?.force)
    .catch(() => false);

  const video = await prisma.video.findUnique({
    where: { id },
    select: { id: true, title: true, isPublished: true, athletesNotifiedAt: true },
  });
  if (!video) {
    return NextResponse.json({ error: 'Видео не найдено' }, { status: 404 });
  }
  if (!video.isPublished) {
    return NextResponse.json({ error: 'Видео не опубликовано' }, { status: 400 });
  }
  if (video.athletesNotifiedAt && !force) {
    return NextResponse.json(
      { error: 'Уведомление уже отправлялось', notifiedAt: video.athletesNotifiedAt },
      { status: 409 },
    );
  }

  // Аудитория — все атлеты (у кого есть push-подписка, тех и достанет broadcast).
  const athletes = await prisma.user.findMany({
    where: { role: 'ATHLETE' },
    select: { id: true },
  });
  const result = await broadcastPush(
    athletes.map((a) => a.id),
    {
      title: 'Новое видео-занятие! 🏒',
      body: video.title,
      url: `/video/${video.id}`,
    },
  );

  await prisma.video.update({
    where: { id: video.id },
    // Сохраняем дату ПЕРВОЙ рассылки; повтор (force) её не перезаписывает.
    data: { athletesNotifiedAt: video.athletesNotifiedAt ?? new Date() },
  });

  return NextResponse.json({ ok: true, ...result });
}
