import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUserId } from '@/lib/auth-server';
import { requireAuthUser } from '@/lib/coach/guards';
import { recalcTrainerRating } from '@/lib/trainer-rating';

// Отзывы о тренере.
//  GET  (публичный) — одобренные отзывы + averageRating/count. Если есть сессия,
//        дополнительно viewer: { canReview, completedLesson, myReview } — свой
//        отзыв отдаём даже неодобренным, чтобы показать «на модерации».
//  POST (только авторизованный) — оставить/обновить отзыв. Жёсткий гейт:
//        отзыв возможен ТОЛЬКО после прохождения занятия этого тренера
//        (completed-видео тренера в workout-сессии пользователя).
//        Переотправка сбрасывает isApproved — правка снова уходит на модерацию.

export const dynamic = 'force-dynamic';

const MAX_COMMENT_LENGTH = 1000;

const USER_SELECT = {
  firstName: true,
  lastName: true,
  profile: { select: { avatarUrl: true } },
} as const;

/** Прошёл ли пользователь хотя бы одно занятие этого тренера. */
async function hasCompletedLesson(userId: string, trainerId: string): Promise<boolean> {
  const lesson = await prisma.workoutSessionVideo.findFirst({
    where: {
      completed: true,
      session: { userId },
      video: { trainerId },
    },
    select: { id: true },
  });
  return lesson !== null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: trainerId } = await params;

    const trainer = await prisma.trainer.findUnique({
      where: { id: trainerId },
      select: { id: true },
    });
    if (!trainer) {
      return NextResponse.json({ error: 'Тренер не найден' }, { status: 404 });
    }

    const reviews = await prisma.trainerReview.findMany({
      where: { trainerId, isApproved: true },
      include: { user: { select: USER_SELECT } },
      orderBy: { createdAt: 'desc' },
    });

    const count = reviews.length;
    const averageRating =
      count > 0
        ? Math.round((reviews.reduce((sum, r) => sum + r.rating, 0) / count) * 10) / 10
        : null;

    // Информация для текущего пользователя (если залогинен): может ли оставить
    // отзыв и его собственный отзыв (в т.ч. ещё не одобренный).
    const userId = await getSessionUserId(request);
    let viewer: {
      canReview: boolean;
      completedLesson: boolean;
      myReview: {
        id: string;
        rating: number;
        comment: string | null;
        isApproved: boolean;
        createdAt: Date;
      } | null;
    } | null = null;

    if (userId) {
      const [completedLesson, myReview] = await Promise.all([
        hasCompletedLesson(userId, trainerId),
        prisma.trainerReview.findUnique({
          where: { trainerId_userId: { trainerId, userId } },
          select: { id: true, rating: true, comment: true, isApproved: true, createdAt: true },
        }),
      ]);
      viewer = { canReview: completedLesson, completedLesson, myReview };
    }

    return NextResponse.json({ reviews, averageRating, count, viewer });
  } catch (error) {
    console.error('Error fetching trainer reviews:', error);
    return NextResponse.json({ error: 'Ошибка загрузки отзывов' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: trainerId } = await params;

    const auth = await requireAuthUser(request);
    if ('response' in auth) return auth.response;
    const userId = auth.user.id;

    const trainer = await prisma.trainer.findUnique({
      where: { id: trainerId },
      select: { id: true },
    });
    if (!trainer) {
      return NextResponse.json({ error: 'Тренер не найден' }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const rating = Number(body?.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'Оценка — целое число от 1 до 5' }, { status: 400 });
    }

    let comment: string | null = null;
    if (body?.comment !== undefined && body?.comment !== null) {
      if (typeof body.comment !== 'string') {
        return NextResponse.json({ error: 'Комментарий должен быть строкой' }, { status: 400 });
      }
      const trimmed = body.comment.trim();
      if (trimmed.length > MAX_COMMENT_LENGTH) {
        return NextResponse.json(
          { error: `Комментарий — до ${MAX_COMMENT_LENGTH} символов` },
          { status: 400 },
        );
      }
      comment = trimmed || null;
    }

    // Гейт владельца: отзыв возможен только после прохождения занятия тренера.
    const completedLesson = await hasCompletedLesson(userId, trainerId);
    if (!completedLesson) {
      return NextResponse.json(
        { error: 'Оставить отзыв можно после прохождения занятия этого тренера' },
        { status: 403 },
      );
    }

    // Один отзыв на пару (trainerId, userId). Переотправка обновляет отзыв и
    // сбрасывает isApproved — правка снова уходит на модерацию.
    const review = await prisma.trainerReview.upsert({
      where: { trainerId_userId: { trainerId, userId } },
      create: { trainerId, userId, rating, comment },
      update: { rating, comment, isApproved: false, createdAt: new Date() },
      include: { user: { select: USER_SELECT } },
    });

    // Отзыв мог быть одобрен раньше — набор одобренных изменился, пересчитываем.
    await recalcTrainerRating(trainerId);

    return NextResponse.json({ review }, { status: 201 });
  } catch (error) {
    console.error('Error creating trainer review:', error);
    return NextResponse.json({ error: 'Ошибка отправки отзыва' }, { status: 500 });
  }
}
