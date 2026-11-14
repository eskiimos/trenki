import { type Prisma, WorkoutStatus } from '@/generated/prisma';

/**
 * Only propose plans the athlete requested or has already used. The source of
 * legacy plans was not stored: an untouched one may have been made by cron,
 * so it stays in history without interrupting quick training or reminders.
 */
export const ELIGIBLE_MICROCYCLE_WHERE = {
  OR: [
    { requestedAt: { not: null } },
    {
      days: {
        some: {
          workoutSession: {
            is: {
              OR: [
                { status: WorkoutStatus.IN_PROGRESS },
                { startedAt: { not: null } },
                {
                  status: { in: [WorkoutStatus.COMPLETED, WorkoutStatus.PARTIAL] },
                  // A quick-training replacement closes the untouched cycle
                  // day as COMPLETED too. Only work in this actual session
                  // proves participation in the legacy plan.
                  videos: { some: { completed: true } },
                },
              ],
            },
          },
        },
      },
    },
  ],
} satisfies Prisma.MicrocycleWhereInput;
