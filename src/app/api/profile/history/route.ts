import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuthUser } from '@/lib/coach/guards';
import { workoutTitle } from '@/lib/training/workout-title';
import { goalsFromStoredDays } from '@/lib/microcycle/week-plan';
import { WorkoutStatus } from '@/generated/prisma';

/**
 * GET /api/profile/history?limit=50
 *
 * ЕДИНАЯ история активности для экрана «История и избранное»: завершённые
 * тренировки ИИ-тренера (быстрые И цикловые — WorkoutSession) вперемешку с
 * одиночными просмотрами видео каталога (TrainingSession), отсортированные по
 * дате. Раньше экран строился только из TrainingSession, и тренировки ИИ в
 * истории отсутствовали вовсе (правка владельца «нет трень от ии-тренера»).
 *
 * Ответ: { items: [{ type: 'workout', ... } | { type: 'video', ... }] }
 */
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuthUser(request);
    if ('response' in auth) return auth.response;
    const userId = auth.user.id;

    const limitRaw = parseInt(request.nextUrl.searchParams.get('limit') || '50', 10);
    const limit = Number.isInteger(limitRaw) ? Math.min(Math.max(limitRaw, 1), 100) : 50;

    const [sessions, watches] = await Promise.all([
      prisma.workoutSession.findMany({
        // COMPLETED + PARTIAL: досрочный финиш — тоже тренировка. Синтетику
        // (админ-накрутка) и дни, закрытые подстановкой (0 пройденных видео),
        // не показываем — это не реальная активность атлета.
        where: {
          userId,
          status: { in: [WorkoutStatus.COMPLETED, WorkoutStatus.PARTIAL] },
          completedAt: { not: null },
          synthetic: false,
          videos: { some: { completed: true } },
        },
        orderBy: { completedAt: 'desc' },
        take: limit,
        select: {
          id: true,
          status: true,
          completedAt: true,
          goal: true,
          energyState: true,
          coachId: true,
          videos: {
            orderBy: { order: 'asc' },
            select: {
              completed: true,
              video: { select: { id: true, title: true, duration: true } },
            },
          },
          microcycleDay: {
            select: {
              dayOfWeek: true,
              microcycle: {
                select: {
                  cycleNumber: true,
                  days: { select: { dayOfWeek: true, intent: true } },
                },
              },
            },
          },
        },
      }),
      prisma.trainingSession.findMany({
        where: { userId },
        include: {
          video: {
            select: {
              id: true,
              title: true,
              duration: true,
              thumbnail: true,
              tags: true,
              equipment: true,
              trainer: { select: { id: true, name: true, lastName: true, avatar: true } },
              _count: { select: { likes: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
    ]);

    // Звёздочка «в избранном»: какие сессии уже сохранены
    const favorites = sessions.length
      ? await prisma.favoriteWorkout.findMany({
          where: { userId, sourceSessionId: { in: sessions.map((s) => s.id) } },
          select: { id: true, sourceSessionId: true },
        })
      : [];
    const favBySession = new Map(favorites.map((f) => [f.sourceSessionId, f.id]));

    const workoutItems = sessions.map((s) => {
      // Название: быстрая — «цель · состояние»; цикловая — подпись дня из плана
      // недели (цель восстанавливается той же ротацией, что при генерации);
      // тренерская (coachId, создаётся в /api/assignments без goal) — честная
      // подпись «Задание от тренера», а не фолбэк «Тренировка от ИИ-тренера».
      let title = workoutTitle(s.goal, s.energyState);
      let cycleLabel: string | null = null;
      const mday = s.microcycleDay;
      if (mday?.microcycle) {
        const plans = goalsFromStoredDays(
          mday.microcycle.days.map((d) => ({ dayOfWeek: d.dayOfWeek, intent: d.intent })),
          mday.microcycle.cycleNumber,
        );
        const plan = plans.find((p) => p.dayOfWeek === mday.dayOfWeek);
        cycleLabel = `Цикл №${mday.microcycle.cycleNumber}`;
        if (plan && !s.goal) title = plan.label;
      } else if (s.coachId) {
        title = 'Задание от тренера';
      }
      return {
        type: 'workout' as const,
        id: s.id,
        title,
        cycleLabel,
        status: s.status,
        date: s.completedAt!.toISOString(),
        completedModules: s.videos.filter((v) => v.completed).length,
        totalModules: s.videos.length,
        totalDuration: s.videos.reduce((sum, v) => sum + (v.video?.duration || 0), 0),
        modules: s.videos
          .map((v) => v.video)
          .filter((v): v is NonNullable<typeof v> => !!v)
          .map((v) => ({ id: v.id, title: v.title })),
        favoriteId: favBySession.get(s.id) ?? null,
      };
    });

    const videoItems = watches.map((w) => ({
      type: 'video' as const,
      id: w.video.id,
      title: w.video.title,
      date: w.createdAt.toISOString(),
      duration: w.video.duration,
      thumbnail: w.video.thumbnail,
      tags: w.video.tags,
      equipment: w.video.equipment,
      likesCount: w.video._count.likes,
      trainer: {
        id: w.video.trainer.id,
        name: w.video.trainer.name,
        lastName: w.video.trainer.lastName,
        avatar: w.video.trainer.avatar || '/images/avatars/trainer-avatar-1.png',
      },
    }));

    const items = [...workoutItems, ...videoItems]
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .slice(0, limit);

    return NextResponse.json({ items });
  } catch (error) {
    console.error('Error fetching profile history:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
