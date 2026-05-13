import prisma from '@/lib/prisma';
import { sendUserPush } from './push';

/**
 * Закрывает все активные (PENDING/IN_PROGRESS) задания игрока на указанные videoIds.
 * Отправляет push тренерам по каждому закрытому заданию.
 * Безопасно вызывать из любого completion-флоу — игнорирует, если ничего не подходит.
 */
export async function markAssignmentsCompletedForVideos(
  athleteId: string,
  videoIds: string[]
): Promise<void> {
  if (videoIds.length === 0) return;

  const active = await prisma.trainingAssignment.findMany({
    where: {
      athleteId,
      videoId: { in: videoIds },
      status: { in: ['PENDING', 'IN_PROGRESS'] },
    },
    select: { id: true, coachId: true, videoId: true },
  });

  if (active.length === 0) return;

  await prisma.trainingAssignment.updateMany({
    where: { id: { in: active.map((a) => a.id) } },
    data: { status: 'COMPLETED', completedAt: new Date() },
  });

  // Получаем имя атлета один раз
  const athlete = await prisma.user.findUnique({
    where: { id: athleteId },
    select: { firstName: true, lastName: true },
  });
  const athleteName = `${athlete?.firstName ?? ''} ${athlete?.lastName ?? ''}`.trim() || 'Игрок';

  // Группируем по тренеру, чтобы не спамить пушами при множественных заданиях
  const coachIds = Array.from(new Set(active.map((a) => a.coachId)));
  await Promise.allSettled(
    coachIds.map((coachId) =>
      sendUserPush(coachId, {
        title: 'Задание выполнено',
        body: `${athleteName} закрыл назначенную тренировку`,
        url: '/coach/assignments',
      })
    )
  );
}
