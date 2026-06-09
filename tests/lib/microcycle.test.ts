import { describe, expect, it } from 'vitest';
import {
  INTENT_PARAMS,
  MICROCYCLE_DAYS_ORDER,
  applyAdjustment,
  feedbackToFactor,
} from '@/lib/microcycle/intents';
import {
  getMicrocycleStartDate,
  getMicrocycleWeekStart,
  getMicrocycleDayDate,
} from '@/lib/microcycle/week-start';
import { getEffectiveStatus } from '@/lib/microcycle/status';
import {
  MicrocycleIntent,
  EnergyState,
  MicrocycleFeedback,
  MicrocycleStatus,
} from '@/generated/prisma';

describe('microcycle/intents', () => {
  it('has all 5 intents in canonical order Пн → Пт', () => {
    expect(MICROCYCLE_DAYS_ORDER).toEqual([
      MicrocycleIntent.IN_TONE,
      MicrocycleIntent.WARMUP,
      MicrocycleIntent.CHARGED,
      MicrocycleIntent.STRETCH,
      MicrocycleIntent.TIRED,
    ]);
  });

  it('maps each intent to a unique consecutive dayOfWeek 1..5', () => {
    const days = MICROCYCLE_DAYS_ORDER.map((i) => INTENT_PARAMS[i].dayOfWeek);
    expect(days).toEqual([1, 2, 3, 4, 5]);
  });

  it('defines goal+energyState for every intent', () => {
    for (const intent of MICROCYCLE_DAYS_ORDER) {
      const p = INTENT_PARAMS[intent];
      expect(p.goal).toBeTruthy();
      expect(p.energyState).toBeTruthy();
      expect(p.label).toBeTruthy();
    }
  });
});

describe('microcycle/week-start', () => {
  // Helper для построения чистого UTC Date.
  const utc = (y: number, m: number, d: number) =>
    new Date(Date.UTC(y, m - 1, d, 12, 0, 0, 0)); // полдень — чтобы не было сюрпризов

  describe('getMicrocycleStartDate (today)', () => {
    it('returns today (Mon)', () => {
      expect(getMicrocycleStartDate(utc(2026, 6, 8)).toISOString().slice(0, 10))
        .toBe('2026-06-08');
    });

    it('returns today (Wed)', () => {
      expect(getMicrocycleStartDate(utc(2026, 6, 10)).toISOString().slice(0, 10))
        .toBe('2026-06-10');
    });

    it('returns today (Sat)', () => {
      expect(getMicrocycleStartDate(utc(2026, 6, 13)).toISOString().slice(0, 10))
        .toBe('2026-06-13');
    });

    it('normalizes to 00:00:00 UTC', () => {
      const result = getMicrocycleStartDate(utc(2026, 6, 10));
      expect(result.getUTCHours()).toBe(0);
      expect(result.getUTCMinutes()).toBe(0);
      expect(result.getUTCSeconds()).toBe(0);
    });
  });

  describe('getMicrocycleWeekStart (cron, ближайший Пн)', () => {
    it('returns today if today is Monday', () => {
      expect(getMicrocycleWeekStart(utc(2026, 6, 8)).toISOString().slice(0, 10))
        .toBe('2026-06-08');
    });

    it('rounds Tuesday to next Monday', () => {
      expect(getMicrocycleWeekStart(utc(2026, 6, 9)).toISOString().slice(0, 10))
        .toBe('2026-06-15');
    });

    it('rounds Sunday to next Monday (tomorrow)', () => {
      expect(getMicrocycleWeekStart(utc(2026, 6, 14)).toISOString().slice(0, 10))
        .toBe('2026-06-15');
    });

    it('handles year boundary', () => {
      // 2026-12-31 (Thu) → 2027-01-04 (Mon)
      expect(getMicrocycleWeekStart(utc(2026, 12, 31)).toISOString().slice(0, 10))
        .toBe('2027-01-04');
    });
  });

  describe('getMicrocycleDayDate', () => {
    const start = utc(2026, 6, 10); // среда — стартуем с неё

    it('returns startDate for dayOfWeek=1', () => {
      expect(getMicrocycleDayDate(start, 1).toISOString().slice(0, 10))
        .toBe('2026-06-10');
    });

    it('returns startDate + 4 days for dayOfWeek=5', () => {
      expect(getMicrocycleDayDate(start, 5).toISOString().slice(0, 10))
        .toBe('2026-06-14');
    });

    it('throws for invalid dayOfWeek', () => {
      expect(() => getMicrocycleDayDate(start, 0)).toThrow();
      expect(() => getMicrocycleDayDate(start, 6)).toThrow();
      expect(() => getMicrocycleDayDate(start, 7)).toThrow();
    });
  });
});

describe('microcycle/feedbackToFactor', () => {
  it('EASY → +1, NORMAL → 0, HARD → -1, null → 0', () => {
    expect(feedbackToFactor(MicrocycleFeedback.EASY)).toBe(1);
    expect(feedbackToFactor(MicrocycleFeedback.NORMAL)).toBe(0);
    expect(feedbackToFactor(MicrocycleFeedback.HARD)).toBe(-1);
    expect(feedbackToFactor(null)).toBe(0);
  });
});

describe('microcycle/applyAdjustment', () => {
  const base = INTENT_PARAMS[MicrocycleIntent.IN_TONE]; // energyState = IN_TONE

  it('returns same params when factor is 0 or null', () => {
    expect(applyAdjustment(base, 0)).toEqual(base);
    expect(applyAdjustment(base, null)).toEqual(base);
  });

  it('shifts energyState up when EASY (+1)', () => {
    expect(applyAdjustment(base, 1).energyState).toBe(EnergyState.FULLY_CHARGED);
  });

  it('shifts energyState down when HARD (-1)', () => {
    expect(applyAdjustment(base, -1).energyState).toBe(EnergyState.TIRED);
  });

  it('caps at FULLY_CHARGED when already maxed', () => {
    const charged = INTENT_PARAMS[MicrocycleIntent.CHARGED]; // FULLY_CHARGED
    expect(applyAdjustment(charged, 1).energyState).toBe(EnergyState.FULLY_CHARGED);
  });

  it('caps at TIRED when already minned', () => {
    const tired = INTENT_PARAMS[MicrocycleIntent.TIRED]; // TIRED
    expect(applyAdjustment(tired, -1).energyState).toBe(EnergyState.TIRED);
  });

  it('preserves goal and dayOfWeek', () => {
    const result = applyAdjustment(base, 1);
    expect(result.goal).toBe(base.goal);
    expect(result.dayOfWeek).toBe(base.dayOfWeek);
    expect(result.label).toBe(base.label);
  });
});

describe('microcycle/getEffectiveStatus', () => {
  const monday = new Date(Date.UTC(2026, 5, 8)); // 2026-06-08

  it('ARCHIVED when feedback set', () => {
    expect(
      getEffectiveStatus(
        { status: MicrocycleStatus.ACTIVE, weekStartDate: monday, feedback: MicrocycleFeedback.NORMAL },
        new Date(Date.UTC(2026, 5, 10)),
      ),
    ).toBe('ARCHIVED');
  });

  it('ARCHIVED when DB status is ARCHIVED', () => {
    expect(
      getEffectiveStatus(
        { status: MicrocycleStatus.ARCHIVED, weekStartDate: monday, feedback: null },
        new Date(Date.UTC(2026, 5, 10)),
      ),
    ).toBe('ARCHIVED');
  });

  it('ACTIVE during the week', () => {
    expect(
      getEffectiveStatus(
        { status: MicrocycleStatus.ACTIVE, weekStartDate: monday, feedback: null },
        new Date(Date.UTC(2026, 5, 10)), // Wed of same week
      ),
    ).toBe('ACTIVE');
  });

  it('AWAITING_FEEDBACK on next Monday and later', () => {
    expect(
      getEffectiveStatus(
        { status: MicrocycleStatus.ACTIVE, weekStartDate: monday, feedback: null },
        new Date(Date.UTC(2026, 5, 15)), // next Mon — exactly 7 days later
      ),
    ).toBe('AWAITING_FEEDBACK');
  });

  it('boundary: exactly at weekStart+7 is AWAITING', () => {
    const sevenDaysLater = new Date(Date.UTC(2026, 5, 15, 0, 0, 0, 0));
    expect(
      getEffectiveStatus(
        { status: MicrocycleStatus.ACTIVE, weekStartDate: monday, feedback: null },
        sevenDaysLater,
      ),
    ).toBe('AWAITING_FEEDBACK');
  });
});
