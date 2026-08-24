import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuthUser } from '@/lib/coach/guards';
import {
  calculateWorkoutGains,
  calculatePotential,
  videoLoadTypes,
  type CharacteristicType,
} from '@/lib/characteristics';
import { XP_PER_COMPLETED_MODULE, XP_PER_COMPLETED_WORKOUT } from '@/lib/gamification';

/**
 * GET /api/training/skip-preview?sessionId=&videoId=
 *
 * «Что теряешь, пропуская модуль» — данные для красивого предупреждения в
 * плеере (решение владельца: пропускать можно, но показать цену с иконками).
 * Считает прирост характеристик РОВНО этого модуля от текущих рейтингов —
 * той же математикой, что боевое начисление (/api/training/complete).
 *
 * Ответ: { xp, gains: { ratingPower... }, potentialGain }
 * XP — базовые 20 БЕЗ множителя темпа: множитель клиент уже знает из
 * /api/gamification/summary и показывает сам.
 */
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuthUser(request);
    if ('response' in auth) return auth.response;

    const sessionId = request.nextUrl.searchParams.get('sessionId') ?? '';
    const videoId = request.nextUrl.searchParams.get('videoId') ?? '';
    if (!sessionId || !videoId) {
      return NextResponse.json({ error: 'sessionId и videoId обязательны' }, { status: 400 });
    }

    const [row, profile] = await Promise.all([
      prisma.workoutSessionVideo.findUnique({
        where: { sessionId_videoId: { sessionId, videoId } },
        select: {
          session: {
            select: {
              userId: true,
              videos: { select: { skipped: true } },
            },
          },
          video: {
            select: {
              moduleType: true,
              loadType: true,
              videoTags: { select: { tag: { select: { tagType: true, loadType: true } } } },
            },
          },
        },
      }),
      prisma.profile.findUnique({
        where: { userId: auth.user.id },
        select: {
          ratingPower: true,
          ratingSpeed: true,
          ratingEndurance: true,
          ratingTechnique: true,
          ratingFlexibility: true,
        },
      }),
    ]);

    if (!row || row.session.userId !== auth.user.id) {
      return NextResponse.json({ error: 'Модуль не найден' }, { status: 404 });
    }
    if (!profile) {
      return NextResponse.json({ error: 'Профиль не найден' }, { status: 404 });
    }

    const current: Record<CharacteristicType, number> = {
      ratingPower: profile.ratingPower,
      ratingSpeed: profile.ratingSpeed,
      ratingEndurance: profile.ratingEndurance,
      ratingTechnique: profile.ratingTechnique,
      ratingFlexibility: profile.ratingFlexibility,
    };
    const isWarm = row.video.moduleType === 'WARMUP' || row.video.moduleType === 'COOLDOWN';
    const gains = calculateWorkoutGains([videoLoadTypes(row.video)], current, [isWarm]);

    const next: Record<CharacteristicType, number> = {
      ratingPower: Math.min(100, current.ratingPower + gains.ratingPower),
      ratingSpeed: Math.min(100, current.ratingSpeed + gains.ratingSpeed),
      ratingEndurance: Math.min(100, current.ratingEndurance + gains.ratingEndurance),
      ratingTechnique: Math.min(100, current.ratingTechnique + gains.ratingTechnique),
      ratingFlexibility: Math.min(100, current.ratingFlexibility + gains.ratingFlexibility),
    };
    const potentialGain = Math.max(
      0,
      parseFloat((calculatePotential(next) - calculatePotential(current)).toFixed(2)),
    );

    // ПЕРВЫЙ скип в сессии стоит дороже всех: он переводит финиш в PARTIAL и
    // сжигает бонус ×100 за полную тренировку. Последующие скипы бонус уже не
    // трогают (он потерян) — показываем его в цене только один раз.
    const hasOtherSkips = row.session.videos.some((v) => v.skipped);
    const bonusForfeited = hasOtherSkips ? 0 : XP_PER_COMPLETED_WORKOUT;

    return NextResponse.json({
      xp: XP_PER_COMPLETED_MODULE,
      bonusForfeited,
      gains,
      potentialGain,
    });
  } catch (error) {
    console.error('Ошибка skip-preview:', error);
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 });
  }
}
