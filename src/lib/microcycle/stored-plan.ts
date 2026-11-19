import type { MicrocycleIntent, ModuleType, TrainingGoal } from '@/generated/prisma';
import { goalsFromStoredDays, labelFor, parsePrevDay } from './week-plan';
import { isMacrocyclePhase, MACROCYCLE_FOCUS_LABELS, macrocycleSlots } from './macrocycle-templates';

interface StoredDay {
  dayOfWeek: number;
  intent: MicrocycleIntent;
}

interface StoredCycle {
  cycleNumber: number;
  macrocycleWeek: number | null;
  days: StoredDay[];
}

export function macrocycleWeekLabel(week: number | null): string | null {
  return isMacrocyclePhase(week) ? `Неделя ${week} из 4 · ${MACROCYCLE_FOCUS_LABELS[week]}` : null;
}

/** Only legacy weeks used the numbered rotation of training goals. */
export function storedDayPlans(cycle: StoredCycle): { dayOfWeek: number; label: string; goal: TrainingGoal | null }[] {
  if (cycle.macrocycleWeek === null) return goalsFromStoredDays(cycle.days, cycle.cycleNumber);
  return cycle.days.map(({ dayOfWeek, intent }) => {
    const { kind, energyState } = parsePrevDay(dayOfWeek, intent);
    return { dayOfWeek, label: labelFor(kind, energyState), goal: null };
  });
}

export function missingMacrocycleModules(
  week: number | null,
  intent: MicrocycleIntent,
  available: (ModuleType | null)[],
): ModuleType[] {
  if (!isMacrocyclePhase(week)) return [];
  return macrocycleSlots(week, intent)
    .map((slot) => slot.moduleType)
    .filter((type) => !available.includes(type));
}
