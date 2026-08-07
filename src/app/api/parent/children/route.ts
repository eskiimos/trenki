// Дети текущего родителя (по ParentLink) + их прогресс read-only:
// имя/аватар/потенциал + сводка геймификации (общий хелпер с
// /api/gamification/summary) + активность за 7 дней.

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuthUser } from '@/lib/coach/guards';
import { getGamificationSummary, getWeekActivity } from '@/lib/gamification-server';
import { hasPremium } from '@/lib/access';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await requireAuthUser(request);
  if ('response' in auth) return auth.response;
  const userId = auth.user.id;

  try {
    const links = await prisma.parentLink.findMany({
      where: { parentId: userId },
      orderBy: { createdAt: 'asc' },
      select: {
        child: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            accessTier: true,
            premiumUntil: true,
            profile: {
              select: {
                avatarUrl: true,
                potential: true,
                ratingPower: true,
                ratingSpeed: true,
                ratingEndurance: true,
                ratingTechnique: true,
                ratingFlexibility: true,
              },
            },
          },
        },
      },
    });

    const children = await Promise.all(
      links.map(async ({ child }) => {
        const [gamification, week] = await Promise.all([
          getGamificationSummary(child.id),
          getWeekActivity(child.id),
        ]);
        return {
          id: child.id,
          firstName: child.firstName,
          lastName: child.lastName,
          avatarUrl: child.profile?.avatarUrl ?? null,
          potential: child.profile?.potential ?? null,
          // Характеристики для кольца потенциала в родительском кабинете
          ratings: {
            power: child.profile?.ratingPower ?? null,
            speed: child.profile?.ratingSpeed ?? null,
            endurance: child.profile?.ratingEndurance ?? null,
            technique: child.profile?.ratingTechnique ?? null,
            flexibility: child.profile?.ratingFlexibility ?? null,
          },
          // Подписка ребёнка — родитель видит статус и может оплатить из кабинета
          premium: { active: hasPremium(child), until: child.premiumUntil },
          gamification,
          week,
        };
      }),
    );

    return NextResponse.json({ children });
  } catch (error) {
    logger.error('parent children fetch failed', error);
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 });
  }
}
