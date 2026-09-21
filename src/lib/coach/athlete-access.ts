import prisma from '@/lib/prisma';
import type { Prisma } from '@/generated/prisma';

// Связь «тренер — атлет» для проверок доступа к данным атлета.
// Критерий тот же, что у /api/athletes/[id]/coach-view: атлет — ACTIVE-участник
// команды, которую создал тренер. Заявки (PENDING), приглашения и отклонённые
// доступа не дают; ушёл из команды — тренер перестаёт видеть его данные.

/** Фильтр Prisma по User: «атлеты команд этого тренера». */
export function coachAthletesWhere(coachId: string): Prisma.UserWhereInput {
  return {
    teamMemberships: {
      some: { status: 'ACTIVE', team: { createdBy: coachId } },
    },
  };
}

/** Состоит ли атлет в ACTIVE-составе хотя бы одной команды тренера. */
export async function isCoachOfAthlete(coachId: string, athleteId: string): Promise<boolean> {
  if (!coachId || !athleteId || coachId === athleteId) return false;
  const membership = await prisma.teamMember.findFirst({
    where: { userId: athleteId, status: 'ACTIVE', team: { createdBy: coachId } },
    select: { id: true },
  });
  return Boolean(membership);
}
