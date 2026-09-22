import { prisma } from '@/lib/prisma';
import type { ParentTask, Prisma } from '@/generated/prisma';
import { countedWorkoutWhere, REAL_WORKOUTS } from '@/lib/stats/workout-definition';
import { sendEmail } from '@/lib/email';
import { unsubscribeUrl } from '@/lib/email-campaigns';
import { logger } from '@/lib/logger';
import { taskCompletedEmail } from '@/lib/parent-tasks';
import { activeDueCutoff } from '@/lib/assignments/active';

// Прогресс и закрытие заданий от родителя. Прогресс не хранится: это число
// реальных тренировок ребёнка с целью задания после его выдачи (то же правило
// «что считать тренировкой», что в админке и дайджесте: завершённые и
// досрочно завершённые, без синтетики, хотя бы один модуль).

export function taskProgressWhere(
  task: Pick<ParentTask, 'childId' | 'goal' | 'createdAt'>,
): Prisma.WorkoutSessionWhereInput {
  return {
    ...countedWorkoutWhere(REAL_WORKOUTS),
    userId: task.childId,
    goal: task.goal,
    completedAt: { gte: task.createdAt },
  };
}

/**
 * Задания ребёнка для списков (ребёнок, родитель, дайджест): активные со сроком
 * не раньше since и выполненные после since. Давно просроченные активные не
 * тащим — они только засоряют список. Отменённые не показываем.
 */
export function recentParentTasksWhere(childId: string, since: Date): Prisma.ParentTaskWhereInput {
  return {
    childId,
    OR: [
      { status: 'ACTIVE', dueDate: { gte: since } },
      { status: 'COMPLETED', completedAt: { gte: since } },
    ],
  };
}

export async function countTaskProgress(task: Pick<ParentTask, 'childId' | 'goal' | 'createdAt'>): Promise<number> {
  return prisma.workoutSession.count({ where: taskProgressWhere(task) });
}

export type TaskWithProgress = ParentTask & { done: number };

export async function withProgress(tasks: ParentTask[]): Promise<TaskWithProgress[]> {
  return Promise.all(
    tasks.map(async (t) => ({
      ...t,
      done: t.status === 'COMPLETED' ? t.target : Math.min(await countTaskProgress(t), t.target),
    })),
  );
}

/**
 * После тренировки ребёнка: закрыть задания, где набралось нужное число
 * тренировок, и написать родителю. Идемпотентно (updateMany по статусу),
 * ошибки только логируются — тренировку это не ломает.
 */
export async function settleParentTasks(childId: string): Promise<void> {
  try {
    // Закрываем только живые задания (срок + те же 3 дня люфта, что у «Моих
    // заданий»): давно просроченное не должно «выполниться» через месяц само.
    const active = await prisma.parentTask.findMany({
      where: { childId, status: 'ACTIVE', dueDate: { gte: activeDueCutoff(new Date()) } },
    });
    for (const task of active) {
      const done = await countTaskProgress(task);
      if (done < task.target) continue;
      const { count } = await prisma.parentTask.updateMany({
        where: { id: task.id, status: 'ACTIVE' },
        data: { status: 'COMPLETED', completedAt: new Date() },
      });
      if (count === 1) await notifyParentTaskDone(task);
    }
  } catch (error) {
    logger.error('settleParentTasks failed', error, { childId });
  }
}

async function notifyParentTaskDone(task: ParentTask): Promise<void> {
  const [parent, child] = await Promise.all([
    prisma.user.findUnique({ where: { id: task.parentId }, select: { id: true, email: true, emailOptOut: true } }),
    prisma.user.findUnique({ where: { id: task.childId }, select: { firstName: true } }),
  ]);
  if (!parent?.email || parent.emailOptOut) return;
  const mail = taskCompletedEmail({
    childName: child?.firstName || 'Ваш хоккеист',
    goal: task.goal,
    target: task.target,
    unsubscribeUrl: unsubscribeUrl(parent.id),
  });
  const res = await sendEmail({
    to: parent.email,
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
    headers: { 'List-Unsubscribe': `<${unsubscribeUrl(parent.id)}>` },
  });
  if (!res.success) logger.error('parent task done email failed', undefined, { parentId: parent.id, taskId: task.id });
}
