import { prisma } from '@/lib/prisma';
import type { AgeGroup, MicrocycleIntent, Profile } from '@/generated/prisma';
import { getRPERange } from '@/lib/training-algorithm-v3';
import { firstWeekStructure, intentFor } from './week-plan';
import { getMicrocycleStartDate, getMicrocycleWeekStart } from './week-start';
import { getEffectiveStatus } from './status';
import { missingMacrocycleModules } from './stored-plan';
import { macrocycleAgeGroup } from './macrocycle-profile';
import { isMacrocyclePhase, macrocycleSlots, type MacrocyclePhase } from './macrocycle-templates';
import { loadMacrocycleCatalog, selectMacrocycleVideos } from './macrocycle-selection';

export type GenerateStatus = 'CREATED' | 'EXISTING' | 'NO_PROFILE' | 'AGE_REQUIRED'
  | 'NO_MATCHING_VIDEOS' | 'STALE_REBUILD' | 'AUTO_GENERATE_DISABLED';

export interface GeneratedDay {
  dayOfWeek: number;
  intent: MicrocycleIntent;
  workoutSessionId: string | null;
  moduleCount: number;
  missingModules: string[];
}

export interface GenerateResult {
  status: GenerateStatus;
  microcycleId?: string;
  weekStartDate?: Date;
  cycleNumber?: number;
  macrocycleWeek?: number | null;
  days?: GeneratedDay[];
  rebuilt?: boolean;
}

interface Options {
  now?: Date;
  startDate?: Date;
  onlyIfAutoGenerateEnabled?: boolean;
  rebuildId?: string;
}

function buildWeek(
  startDate: Date, phase: MacrocyclePhase, age: AgeGroup, potential: number,
  catalog: Awaited<ReturnType<typeof loadMacrocycleCatalog>>,
) {
  const days = firstWeekStructure(startDate.getUTCDay()).map(day => {
    const intent = intentFor(day.kind, day.energyState);
    return { ...day, intent, slots: macrocycleSlots(phase, intent) };
  });
  const assignments = selectMacrocycleVideos(days.flatMap(day => day.slots), catalog, potential);
  let offset = 0;
  return days.map(day => {
    const selected = assignments.slice(offset, offset + day.slots.length);
    offset += day.slots.length;
    const modules = selected.filter(video => video !== null);
    const rpe = getRPERange(day.energyState, potential, age);
    return {
      dayOfWeek: day.dayOfWeek,
      intent: day.intent,
      modules,
      missingModules: day.slots.flatMap((slot, i) => selected[i] ? [] : [slot.moduleType]),
      targetRPE: Math.round((rpe.min + rpe.max) / 2),
      targetDuration: Math.round(modules.reduce((sum, video) => sum + video.duration, 0) / 60),
    };
  });
}

const nextPhase = (week: number | null | undefined): MacrocyclePhase => {
  switch (week) {
    case 1: return 2;
    case 2: return 3;
    case 3: return 4;
    default: return 1;
  }
};

export async function generateMicrocycleForUser(userId: string, opts: Options = {}): Promise<GenerateResult> {
  const requestedStart = opts.startDate ?? getMicrocycleStartDate(opts.now ?? new Date());
  return prisma.$transaction(async tx => {
    // Serialize the cron, manual requests and preference changes for this athlete.
    // Read the previous phase only after acquiring the lock.
    const [profile] = await tx.$queryRaw<Pick<Profile, 'ageGroup' | 'birthDate' | 'potential' | 'autoGenerateMicrocycle'>[]>`
      SELECT "ageGroup", "birthDate", potential, "autoGenerateMicrocycle"
      FROM profiles WHERE "userId" = ${userId} FOR UPDATE
    `;
    if (!profile) return { status: 'NO_PROFILE' };
    if (opts.onlyIfAutoGenerateEnabled && !profile.autoGenerateMicrocycle) {
      return { status: 'AUTO_GENERATE_DISABLED' };
    }
    const last = await tx.microcycle.findFirst({
      where: { userId },
      orderBy: { cycleNumber: 'desc' },
      include: { days: {
        orderBy: { dayOfWeek: 'asc' },
        include: { workoutSession: { select: { videos: { select: { video: { select: { moduleType: true } } } } } } },
      } },
    });
    const active = last && getEffectiveStatus({ ...last, dayCount: last.days.length }, requestedStart) === 'ACTIVE';
    if (opts.rebuildId && (opts.rebuildId !== last?.id || !active)) {
      return { status: 'STALE_REBUILD' };
    }
    if (last && !opts.rebuildId && (active || last.weekStartDate >= requestedStart)) {
      return {
        status: 'EXISTING', microcycleId: last.id, weekStartDate: last.weekStartDate,
        cycleNumber: last.cycleNumber, macrocycleWeek: last.macrocycleWeek,
        days: last.days.map(day => ({
          dayOfWeek: day.dayOfWeek, intent: day.intent, workoutSessionId: day.workoutSessionId,
          moduleCount: day.workoutSession?.videos.length ?? 0,
          missingModules: missingMacrocycleModules(last.macrocycleWeek, day.intent,
            day.workoutSession?.videos.map(v => v.video.moduleType) ?? []),
        })),
      };
    }

    const age = macrocycleAgeGroup(profile);
    if (!age) return { status: 'AGE_REQUIRED' };
    const replaced = opts.rebuildId ? last : null;
    let weekStartDate = requestedStart;
    if (replaced && replaced.weekStartDate > requestedStart) {
      weekStartDate = replaced.weekStartDate;
    } else if (!replaced && last) {
      // A finished Friday plan can be followed by a new Monday plan. Starting
      // again on Saturday must not consume two focuses in one calendar week.
      const dayAfterStart = new Date(last.weekStartDate);
      dayAfterStart.setUTCDate(dayAfterStart.getUTCDate() + 1);
      const nextMonday = getMicrocycleWeekStart(dayAfterStart);
      if (weekStartDate < nextMonday) weekStartDate = nextMonday;
    }
    const cycleNumber = replaced?.cycleNumber ?? (last?.cycleNumber ?? 0) + 1;
    const phase = replaced && isMacrocyclePhase(replaced.macrocycleWeek)
      ? replaced.macrocycleWeek : nextPhase(last?.macrocycleWeek);
    const catalog = await loadMacrocycleCatalog(age, tx);
    const plan = buildWeek(weekStartDate, phase, age, profile.potential, catalog);
    if (!plan.some(day => day.modules.length)) return { status: 'NO_MATCHING_VIDEOS' };

    if (replaced) {
      const sessionIds = replaced.days.flatMap(day => day.workoutSessionId ? [day.workoutSessionId] : []);
      await tx.microcycle.delete({ where: { id: replaced.id } });
      await tx.workoutSession.deleteMany({ where: { userId, id: { in: sessionIds } } });
    }
    const cycle = await tx.microcycle.create({
      data: { userId, weekStartDate, cycleNumber, macrocycleWeek: phase, status: 'ACTIVE' },
    });
    const days: GeneratedDay[] = [];
    for (const day of plan) {
      const session = day.modules.length ? await tx.workoutSession.create({
        data: {
          userId, targetDuration: day.targetDuration, targetRPE: day.targetRPE,
          loadDirection: 'MEDIUM', totalVideos: day.modules.length,
          videos: { create: day.modules.map((video, order) => ({ videoId: video.id, order })) },
        },
      }) : null;
      const workoutSessionId = session?.id ?? null;
      await tx.microcycleDay.create({
        data: { microcycleId: cycle.id, dayOfWeek: day.dayOfWeek, intent: day.intent, workoutSessionId },
      });
      days.push({
        dayOfWeek: day.dayOfWeek, intent: day.intent, workoutSessionId,
        moduleCount: day.modules.length, missingModules: day.missingModules,
      });
    }
    return {
      status: 'CREATED', microcycleId: cycle.id, weekStartDate, cycleNumber,
      macrocycleWeek: phase, days, rebuilt: !!replaced,
    };
  }, { timeout: 30_000 });
}
