import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuthUser } from '@/lib/coach/guards';

// GET /api/training/module-candidates?sessionId=&moduleIndex=&q=
// Видео-кандидаты для РУЧНОГО подбора модуля при сборке тренировки: того же
// типа, что текущий слот, опубликованные, с опциональным поиском по названию.
// Фильтрация по нагрузке/мышцам — на клиенте по возвращённым полям.
// IDOR: сессия должна принадлежать вызывающему.
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await requireAuthUser(request);
  if ('response' in auth) return auth.response;

  const url = new URL(request.url);
  const sessionId = url.searchParams.get('sessionId') || '';
  const moduleIndex = Number(url.searchParams.get('moduleIndex'));
  const q = (url.searchParams.get('q') || '').trim();

  if (!sessionId || Number.isNaN(moduleIndex)) {
    return NextResponse.json({ error: 'sessionId и moduleIndex обязательны' }, { status: 400 });
  }

  const session = await prisma.workoutSession.findUnique({
    where: { id: sessionId },
    select: {
      userId: true,
      videos: { orderBy: { order: 'asc' }, select: { videoId: true, video: { select: { moduleType: true } } } },
    },
  });
  if (!session) return NextResponse.json({ error: 'Тренировка не найдена' }, { status: 404 });
  if (session.userId !== auth.user.id) return NextResponse.json({ error: 'Доступ запрещён' }, { status: 403 });
  if (moduleIndex < 0 || moduleIndex >= session.videos.length) {
    return NextResponse.json({ error: 'Неправильный индекс модуля' }, { status: 400 });
  }

  const slot = session.videos[moduleIndex];
  const moduleType = slot.video.moduleType;
  const usedIds = session.videos.map((v) => v.videoId);

  const videos = await prisma.video.findMany({
    where: {
      isPublished: true,
      moduleType,
      ...(q ? { title: { contains: q, mode: 'insensitive' } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: {
      id: true, title: true, thumbnail: true, duration: true,
      loadType: true, muscleGroup: true, complexity: true,
      trainer: { select: { name: true, lastName: true } },
    },
  });

  return NextResponse.json({
    moduleType,
    currentVideoId: slot.videoId,
    videos: videos.map((v) => ({
      id: v.id,
      title: v.title,
      thumbnail: v.thumbnail,
      duration: v.duration,
      loadType: v.loadType,
      muscleGroup: v.muscleGroup,
      complexity: v.complexity,
      trainer: v.trainer ? `${v.trainer.name} ${v.trainer.lastName}`.trim() : null,
      inWorkout: usedIds.includes(v.id),
    })),
  });
}
