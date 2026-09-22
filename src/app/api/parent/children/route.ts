// Дети текущего родителя (по ParentLink) + их прогресс read-only:
// имя/аватар/потенциал + сводка геймификации (общий хелпер с
// /api/gamification/summary) + активность за 7 дней.

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuthUser } from '@/lib/coach/guards';
import { getGamificationSummary, getWeekActivity } from '@/lib/gamification-server';
import { hasPremium } from '@/lib/access';
import { getPaywallMode } from '@/lib/settings';
import { isPaywalled } from '@/lib/paywall';
import { recentParentTasksWhere, withProgress } from '@/lib/parent-tasks-server';
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
        id: true,
        unlinkRequestedAt: true,
        relation: true,
        child: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            accessTier: true,
            premiumUntil: true,
            isAdmin: true,
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

    const mode = await getPaywallMode();
    const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const children = await Promise.all(
      links.map(async ({ id: linkId, unlinkRequestedAt, relation, child }) => {
        const [gamification, week, tasks] = await Promise.all([
          getGamificationSummary(child.id),
          getWeekActivity(child.id),
          // Задания от родителей ребёнку (п.9б): активные и закрытые за месяц
          prisma.parentTask
            .findMany({
              where: recentParentTasksWhere(child.id, monthAgo),
              orderBy: { createdAt: 'desc' },
              take: 20,
            })
            .then(withProgress),
        ]);
        return {
          id: child.id,
          // Связь родитель↔ребёнок: для подтверждения/отклонения запроса на
          // отвязку и самостоятельной отвязки (POST /api/parent/unlink)
          linkId,
          unlinkRequestedAt,
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
          tasks,
          // Кем этот родитель приходится ребёнку — по умолчанию в форме задания
          relation,
          // Задания ведут в платную быструю тренировку — без подписки не даём
          paywalled: isPaywalled(child, mode),
        };
      }),
    );

    return NextResponse.json({ children });
  } catch (error) {
    logger.error('parent children fetch failed', error);
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 });
  }
}
