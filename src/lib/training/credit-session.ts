import { prisma } from '@/lib/prisma';
import { WorkoutStatus } from '@/generated/prisma';
import {
  calculateWorkoutGains,
  calculatePotential,
  videoLoadTypes,
  type CharacteristicType,
} from '@/lib/characteristics';

// Начисление прироста за завершённую сессию — та же математика, что в боевом
// POST /api/training/complete (типы нагрузки по video.loadType через
// videoLoadTypes, x0.5 за разминку/заминку, cap 100, потенциал = среднее).
// Пишет CharacteristicHistory (sessionId, eventType WORKOUT) и ставит сессии
// статус COMPLETED. Идемпотентно: уже COMPLETED → ничего не начисляет (защита
// от двойного начисления). forceVideos помечает все видео сессии выполненными
// (для QA-прожатия цикла без реального прокликивания модулей).
//
// Намеренно НЕ трогает trainingsToday/lastTrainingDate: цикловые тренировки не
// расходуют дневной лимит (см. isCycleTraining в /api/training/complete).

export interface CreditResult {
  alreadyCompleted: boolean;
  credited: boolean;
  gains?: Record<CharacteristicType, number>;
  potentialBefore?: number;
  potentialAfter?: number;
}

export async function creditSessionCompletion(
  userId: string,
  sessionId: string,
  opts: { forceVideos?: boolean } = {},
): Promise<CreditResult> {
  return prisma.$transaction(async (tx) => {
    const session = await tx.workoutSession.findUnique({
      where: { id: sessionId },
      include: {
        videos: { include: { video: { include: { videoTags: { include: { tag: true } } } } } },
      },
    });
    // Чужая/несуществующая сессия — молча пропускаем (вызывающий уже под auth).
    if (!session || session.userId !== userId) {
      return { alreadyCompleted: false, credited: false };
    }
    // Идемпотентность: повторно завершённую не начисляем.
    if (session.status === WorkoutStatus.COMPLETED) {
      return { alreadyCompleted: true, credited: false };
    }

    // Атомарный «захват» сессии: помечаем COMPLETED, только если она ещё не
    // завершена. При гонке (две параллельные транзакции на одну сессию) второй
    // получит count=0 и НЕ начислит — защита от двойного начисления на уровне
    // row-lock БД, а не только read-check-write выше.
    const now = new Date();
    const claim = await tx.workoutSession.updateMany({
      where: { id: sessionId, status: { not: WorkoutStatus.COMPLETED } },
      data: { status: WorkoutStatus.COMPLETED, completedAt: now },
    });
    if (claim.count === 0) {
      return { alreadyCompleted: true, credited: false };
    }

    if (opts.forceVideos) {
      await tx.workoutSessionVideo.updateMany({
        where: { sessionId },
        data: { completed: true, completedAt: now },
      });
    }

    const profile = await tx.profile.findUnique({ where: { userId } });
    if (!profile) return { alreadyCompleted: false, credited: false };

    const moduleTags = session.videos.map((v) => videoLoadTypes(v.video));
    const warm = session.videos.map(
      (v) => v.video.moduleType === 'WARMUP' || v.video.moduleType === 'COOLDOWN',
    );

    const current: Record<CharacteristicType, number> = {
      ratingPower: profile.ratingPower,
      ratingSpeed: profile.ratingSpeed,
      ratingEndurance: profile.ratingEndurance,
      ratingTechnique: profile.ratingTechnique,
      ratingFlexibility: profile.ratingFlexibility,
    };
    const gains = calculateWorkoutGains(moduleTags, current, warm);

    // Новые значения (cap 100). Потенциал считаем от НЕокруглённых (как боевой
    // роут), сами рейтинги храним с точностью .1.
    const nextRaw: Record<CharacteristicType, number> = {
      ratingPower: Math.min(100, current.ratingPower + gains.ratingPower),
      ratingSpeed: Math.min(100, current.ratingSpeed + gains.ratingSpeed),
      ratingEndurance: Math.min(100, current.ratingEndurance + gains.ratingEndurance),
      ratingTechnique: Math.min(100, current.ratingTechnique + gains.ratingTechnique),
      ratingFlexibility: Math.min(100, current.ratingFlexibility + gains.ratingFlexibility),
    };
    const potentialAfter = calculatePotential(nextRaw);

    await tx.profile.update({
      where: { id: profile.id },
      data: {
        ratingPower: parseFloat(nextRaw.ratingPower.toFixed(1)),
        ratingSpeed: parseFloat(nextRaw.ratingSpeed.toFixed(1)),
        ratingEndurance: parseFloat(nextRaw.ratingEndurance.toFixed(1)),
        ratingTechnique: parseFloat(nextRaw.ratingTechnique.toFixed(1)),
        ratingFlexibility: parseFloat(nextRaw.ratingFlexibility.toFixed(1)),
        potential: potentialAfter,
      },
    });

    await tx.characteristicHistory.create({
      data: {
        userId,
        sessionId,
        ratingPower: parseFloat(nextRaw.ratingPower.toFixed(1)),
        ratingSpeed: parseFloat(nextRaw.ratingSpeed.toFixed(1)),
        ratingEndurance: parseFloat(nextRaw.ratingEndurance.toFixed(1)),
        ratingTechnique: parseFloat(nextRaw.ratingTechnique.toFixed(1)),
        ratingFlexibility: parseFloat(nextRaw.ratingFlexibility.toFixed(1)),
        potential: potentialAfter,
        gainPower: gains.ratingPower,
        gainSpeed: gains.ratingSpeed,
        gainEndurance: gains.ratingEndurance,
        gainTechnique: gains.ratingTechnique,
        gainFlexibility: gains.ratingFlexibility,
        eventType: 'WORKOUT',
      },
    });

    // Статус COMPLETED уже выставлен «захватом» выше.
    return {
      alreadyCompleted: false,
      credited: true,
      gains,
      potentialBefore: profile.potential,
      potentialAfter,
    };
  }, { timeout: 30_000 });
}
