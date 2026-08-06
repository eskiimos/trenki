import { prisma } from '@/lib/prisma';

// Дефолтный рейтинг тренера, когда одобренных отзывов ещё нет
// (совпадает с @default(5.0) в схеме Trainer.rating).
const DEFAULT_TRAINER_RATING = 5.0;

/**
 * Пересчитывает Trainer.rating по ОДОБРЕННЫМ отзывам (isApproved: true).
 * Вызывать после любых изменений набора одобренных отзывов:
 * одобрение/скрытие/удаление в админке и переотправка отзыва пользователем
 * (она сбрасывает isApproved и убирает отзыв из публичного рейтинга).
 */
export async function recalcTrainerRating(trainerId: string): Promise<void> {
  const agg = await prisma.trainerReview.aggregate({
    where: { trainerId, isApproved: true },
    _avg: { rating: true },
  });
  const rating =
    agg._avg.rating === null
      ? DEFAULT_TRAINER_RATING
      : Math.round(agg._avg.rating * 10) / 10;
  await prisma.trainer.update({ where: { id: trainerId }, data: { rating } });
}
