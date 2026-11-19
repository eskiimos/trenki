import type { LoadType, MicrocycleIntent, ModuleType, MuscleGroup } from '@/generated/prisma';

export type MacrocyclePhase = 1 | 2 | 3 | 4;

export const MACROCYCLE_FOCUS_LABELS: Record<MacrocyclePhase, string> = {
  1: 'Всё тело',
  2: 'Ноги',
  3: 'Верх тела',
  4: 'Кор + всё тело',
};

export function isMacrocyclePhase(value: number | null): value is MacrocyclePhase {
  return value === 1 || value === 2 || value === 3 || value === 4;
}

/** Specified conditions within a filter must all match. */
export interface MacrocycleFilter {
  loads?: readonly LoadType[];
  muscles?: readonly MuscleGroup[];
  excludeMuscles?: readonly MuscleGroup[];
}

export interface MacrocycleSlot {
  moduleType: ModuleType;
  /** Any one complete filter qualifies a video for the slot. */
  alternatives: readonly MacrocycleFilter[];
  preferredMuscles?: readonly MuscleGroup[];
}

const full: MuscleGroup[] = ['FULL_BODY'];
const legs: MuscleGroup[] = ['LOWER_BODY'];
const upper: MuscleGroup[] = ['UPPER_PUSH', 'UPPER_PULL'];
const core: MuscleGroup[] = ['CORE_STABILITY', 'CORE_DYNAMICS'];
const upperOrCore = [...upper, ...core];
const upperOrFull = [...upper, ...full];
const legsOrFull = [...legs, ...full];

const mondayFitness: LoadType[] = ['SPEED', 'AEROBIC_ENDURANCE', 'AGILITY'];
const mondayTechnique: LoadType[] = [
  'TECHNICAL_SKILL', 'POWER', 'SPEED', 'STRENGTH_ENDURANCE', 'ANAEROBIC_ENDURANCE',
];
const wednesdayFitness: LoadType[] = [
  'MAX_STRENGTH', 'POWER', 'ANAEROBIC_ENDURANCE', 'STRENGTH_ENDURANCE',
];
const wednesdayTechnique: LoadType[] = ['TECHNICAL_SKILL', 'AGILITY', 'SPEED', 'AEROBIC_ENDURANCE'];
const fridayFitness: LoadType[] = ['AGILITY', 'MOBILITY', 'SPEED'];
const fridayTechnique: LoadType[] = ['TECHNICAL_SKILL', 'AGILITY', 'SPEED'];
const stretch: LoadType[] = ['DYNAMIC_STRETCH', 'STATIC_STRETCH'];

function slot(
  moduleType: ModuleType,
  alternatives: readonly MacrocycleFilter[],
  preferredMuscles?: readonly MuscleGroup[],
): MacrocycleSlot {
  return { moduleType, alternatives, preferredMuscles };
}

const fullWarmup = slot('WARMUP', [{ muscles: full }]);
const legWarmup = slot('WARMUP', [{ muscles: legsOrFull }]);
const upperWarmup = slot('WARMUP', [{ muscles: upperOrFull }]);
const anyWarmup = slot('WARMUP', [{}]);
const dynamicWarmup = slot('WARMUP', [{ loads: ['DYNAMIC_STRETCH'] }]);
const anyStretch = slot('COOLDOWN', [{ loads: stretch }]);

// Key by the training day's intent so a shortened introductory week keeps the
// same module rules even when, e.g., Стандарт falls on a Thursday.
type WeekTemplate = Record<MicrocycleIntent, readonly MacrocycleSlot[]>;
const templates: Record<MacrocyclePhase, WeekTemplate> = {
  1: {
    IN_TONE: [
      fullWarmup,
      slot('FITNESS', [{ loads: mondayFitness }], full),
      slot('TECHNIQUE', [{ loads: mondayTechnique }], full),
    ],
    WARMUP: [anyWarmup],
    CHARGED: [
      dynamicWarmup,
      slot('FITNESS', [{ loads: wednesdayFitness }], full),
      slot('TECHNIQUE', [{ loads: wednesdayTechnique }]),
      anyStretch,
    ],
    STRETCH: [
      fullWarmup,
      slot('COOLDOWN', [{ loads: stretch, muscles: full }, { loads: ['PREHAB'] }]),
    ],
    TIRED: [
      fullWarmup,
      slot('FITNESS', [{ loads: fridayFitness }]),
      slot('TECHNIQUE', [{ loads: fridayTechnique }]),
      anyStretch,
    ],
  },
  2: {
    IN_TONE: [
      legWarmup,
      slot('FITNESS', [{ loads: mondayFitness, muscles: legsOrFull }]),
      slot('TECHNIQUE', [{ loads: mondayTechnique }], full),
    ],
    WARMUP: [legWarmup],
    CHARGED: [
      dynamicWarmup,
      slot('FITNESS', [{ loads: wednesdayFitness, muscles: legs }]),
      slot('TECHNIQUE', [{ loads: wednesdayTechnique }], full),
      anyStretch,
    ],
    STRETCH: [
      legWarmup,
      slot('COOLDOWN', [
        { loads: stretch, muscles: legsOrFull },
        { loads: ['PREHAB'], muscles: ['PREHAB_KNEE'] },
      ]),
    ],
    TIRED: [
      legWarmup,
      slot('FITNESS', [{ loads: fridayFitness, muscles: legsOrFull }], legs),
      slot('TECHNIQUE', [{ loads: fridayTechnique }], full),
      slot('COOLDOWN', [
        { loads: stretch, muscles: legs },
        { loads: ['PREHAB'], muscles: ['PREHAB_KNEE'] },
      ]),
    ],
  },
  3: {
    IN_TONE: [
      upperWarmup,
      slot('FITNESS', [{ loads: mondayFitness, muscles: upperOrFull }]),
      slot('TECHNIQUE', [{ loads: mondayTechnique, muscles: upper }]),
    ],
    WARMUP: [upperWarmup],
    CHARGED: [
      slot('WARMUP', [{ loads: ['DYNAMIC_STRETCH'], muscles: upperOrCore }]),
      slot('FITNESS', [{ loads: wednesdayFitness, muscles: upperOrFull }]),
      slot('TECHNIQUE', [{ loads: wednesdayTechnique }], upper),
      slot('COOLDOWN', [{ loads: stretch, muscles: upper }]),
    ],
    STRETCH: [
      fullWarmup,
      slot('COOLDOWN', [
        { loads: stretch, muscles: upper },
        { loads: ['PREHAB'], muscles: ['PREHAB_SHOULDER'] },
      ]),
    ],
    TIRED: [
      fullWarmup,
      slot('FITNESS', [{ loads: fridayFitness }], upper),
      slot('TECHNIQUE', [{ loads: fridayTechnique }]),
      slot('COOLDOWN', [{ loads: stretch, excludeMuscles: ['LOWER_BODY', 'PREHAB_KNEE'] }]),
    ],
  },
  4: {
    IN_TONE: [
      fullWarmup,
      slot('FITNESS', [{ muscles: ['CORE_DYNAMICS'] }]),
      slot('TECHNIQUE', [{ loads: mondayTechnique }], full),
    ],
    WARMUP: [anyWarmup],
    CHARGED: [
      slot('WARMUP', [{ muscles: core }]),
      slot('FITNESS', [{ muscles: ['CORE_STABILITY'] }]),
      slot('TECHNIQUE', [{ loads: wednesdayTechnique }], upper),
      slot('COOLDOWN', [{ loads: stretch, muscles: upperOrCore }]),
    ],
    STRETCH: [
      fullWarmup,
      slot('COOLDOWN', [
        { loads: stretch, muscles: full },
        { loads: ['PREHAB'], muscles: ['PREHAB_BACK'] },
      ]),
    ],
    TIRED: [
      slot('WARMUP', [{ muscles: [...full, ...core] }]),
      slot('FITNESS', [{ loads: ['AGILITY', 'MOBILITY'] }, { muscles: ['CORE_DYNAMICS'] }]),
      slot('TECHNIQUE', [{ loads: fridayTechnique }]),
      anyStretch,
    ],
  },
};

export function macrocycleSlots(phase: MacrocyclePhase, intent: MicrocycleIntent): readonly MacrocycleSlot[] {
  return templates[phase][intent];
}
