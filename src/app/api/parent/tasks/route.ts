import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuthUser } from '@/lib/coach/guards';
import { rateLimit } from '@/lib/coach/rate-limit';
import { getPaywallMode } from '@/lib/settings';
import { isPaywalled } from '@/lib/paywall';
import { sendUserPush } from '@/lib/coach/push';
import { pushTag } from '@/lib/notifications/push-tag';
import { logger } from '@/lib/logger';
import { parentTaskPush, taskDueDate, validateNewTask } from '@/lib/parent-tasks';
import { getPushTemplates } from '@/lib/notifications/templates-server';
import type { ParentRelation, TrainingGoal } from '@/generated/prisma';

export const dynamic = 'force-dynamic';

/**
 * POST /api/parent/tasks — родитель даёт ребёнку задание (п.9б «Середина
 * сентября», формат «счётчик»).
 *   Body: { childId, goal, target, relation }
 * Только своему ребёнку (ParentLink), только ребёнку с доступом: задание ведёт
 * в быструю тренировку ИИ, а она по подписке (иначе ребёнок упрётся в оплату).
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuthUser(request);
  if ('response' in auth) return auth.response;
  const parentId = auth.user.id;

  const rl = rateLimit(`parent-task:${parentId}`, 10, 60 * 60 * 1000);
  if (!rl.ok) {
    return NextResponse.json({ error: 'Слишком много заданий за час — попробуйте позже' }, { status: 429 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const childId = String(body?.childId || '');
    const link = await prisma.parentLink.findUnique({
      where: { parentId_childId: { parentId, childId } },
      select: {
        id: true,
        child: { select: { id: true, firstName: true, accessTier: true, premiumUntil: true, isAdmin: true } },
      },
    });
    if (!link) return NextResponse.json({ error: 'Ребёнок не найден' }, { status: 404 });

    if (isPaywalled(link.child, await getPaywallMode())) {
      return NextResponse.json(
        { error: 'Задания доступны, когда у ребёнка есть подписка', code: 'CHILD_PAYWALLED' },
        { status: 402 },
      );
    }

    const active = await prisma.parentTask.findMany({
      where: { childId, status: 'ACTIVE', dueDate: { gte: new Date() } },
      select: { goal: true },
    });
    const error = validateNewTask(body, active.map((t) => t.goal));
    if (error) return NextResponse.json({ error }, { status: 400 });

    const relation = body.relation as ParentRelation;
    const [task] = await prisma.$transaction([
      prisma.parentTask.create({
        data: {
          parentId,
          childId,
          relation,
          goal: body.goal as TrainingGoal,
          target: Number(body.target),
          dueDate: taskDueDate(new Date()),
        },
      }),
      // Запоминаем «мама/папа» для следующих заданий
      prisma.parentLink.update({ where: { id: link.id }, data: { relation } }),
    ]);

    const push = parentTaskPush(relation, await getPushTemplates(), link.child.firstName);
    sendUserPush(childId, { ...push, url: '/profile/assignments', tag: pushTag('parent-task-new', task.id) }).catch(
      (err) => logger.error('parent task push failed', err, { childId }),
    );

    return NextResponse.json({ task: { ...task, done: 0 } });
  } catch (error) {
    logger.error('parent task create failed', error, { parentId });
    return NextResponse.json({ error: 'Не удалось создать задание' }, { status: 500 });
  }
}
