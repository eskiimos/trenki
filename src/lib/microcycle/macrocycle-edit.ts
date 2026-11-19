import type { MacrocyclePhase, MacrocycleSlot } from './macrocycle-templates';
import { isMacrocyclePhase, macrocycleSlots } from './macrocycle-templates';
import { type BodyPart, isBodyPart } from './build-day';
import { macrocycleAgeGroup } from './macrocycle-profile';
import { loadMacrocycleCatalog, rankMacrocycleCandidates } from './macrocycle-selection';
import type { MicrocycleIntent, ModuleType, MuscleGroup, Prisma } from '@/generated/prisma';

const stretchGroups: Record<BodyPart, readonly MuscleGroup[]> = {
  lower: ['LOWER_BODY'],
  upper: ['UPPER_PUSH', 'UPPER_PULL'],
  full: ['FULL_BODY'],
};
const rehabGroups: Record<BodyPart, readonly MuscleGroup[]> = {
  lower: ['PREHAB_KNEE'],
  upper: ['PREHAB_SHOULDER'],
  full: ['FULL_BODY'],
};

/** A deliberate recovery-day choice replaces that day's muscle direction.
 * Keep stretching and rehab as separate, load-specific alternatives. */
export function editableMacrocycleSlots(phase: MacrocyclePhase, intent: MicrocycleIntent, bodyPart: string | null) {
  const slots = macrocycleSlots(phase, intent);
  if (intent !== 'STRETCH' || !isBodyPart(bodyPart)) return slots;
  return slots.map((slot): MacrocycleSlot => ({
    ...slot,
    alternatives: slot.alternatives.map(filter => ({
      ...filter,
      muscles: filter.loads?.includes('PREHAB') ? rehabGroups[bodyPart] : stretchGroups[bodyPart],
    })),
  }));
}

export async function loadMacrocycleEdit(
  db: Prisma.TransactionClient, userId: string, sessionId: string,
) {
  const day = await db.microcycleDay.findFirst({
    where: { workoutSessionId: sessionId, microcycle: { userId, macrocycleWeek: { not: null } } },
    select: {
      id: true, intent: true, stretchBodyPart: true,
      workoutSession: { select: {
        videos: { orderBy: { order: 'asc' }, select: {
          id: true, videoId: true, order: true, video: { select: { moduleType: true, duration: true } },
        } },
      } },
      microcycle: { select: {
        macrocycleWeek: true,
        user: { select: { profile: { select: { potential: true, ageGroup: true, birthDate: true } } } },
        days: {
          where: { workoutSessionId: { not: sessionId } },
          select: { workoutSession: { select: { videos: { select: { videoId: true } } } } },
        },
      } },
    },
  });
  const phase = day?.microcycle.macrocycleWeek;
  if (!day?.workoutSession || !phase || !isMacrocyclePhase(phase)) return null;
  const profile = day.microcycle.user.profile;
  const catalog = profile ? await loadMacrocycleCatalog(macrocycleAgeGroup(profile), db) : [];
  const usedIds = new Set(day.microcycle.days.flatMap(d => d.workoutSession?.videos.map(v => v.videoId) ?? []));
  return {
    phase, intent: day.intent, dayId: day.id, stretchBodyPart: day.stretchBodyPart,
    videos: day.workoutSession.videos,
    potential: profile?.potential ?? 0, catalog, usedIds,
  };
}

export async function lockMacrocycleEdit(tx: Prisma.TransactionClient, userId: string) {
  // Generation and edits of different sessions in this athlete's week share this lock.
  await tx.$queryRaw`SELECT id FROM profiles WHERE "userId" = ${userId} FOR UPDATE`;
}

type EditContext = NonNullable<Awaited<ReturnType<typeof loadMacrocycleEdit>>>;

export function replacementCandidates(
  edit: EditContext, current: { videoId: string; video: { moduleType: ModuleType | null } },
  includeCurrent: boolean, directions?: readonly MuscleGroup[] | null,
) {
  const slot = editableMacrocycleSlots(edit.phase, edit.intent, edit.stretchBodyPart)
    .find(s => s.moduleType === current.video.moduleType);
  if (!slot) return [];
  const catalog = slot.moduleType === 'COOLDOWN' && directions
    ? edit.catalog.filter(v => v.muscleGroup && directions.includes(v.muscleGroup))
    : edit.catalog;
  const excludeIds = new Set(edit.videos.map(v => v.videoId));
  if (includeCurrent) excludeIds.delete(current.videoId);
  return rankMacrocycleCandidates(slot, catalog, edit.potential, { excludeIds, usedIds: edit.usedIds });
}
