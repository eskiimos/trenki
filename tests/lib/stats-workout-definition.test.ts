import { describe, it, expect } from 'vitest';
import {
  ADMIN_STATS_WORKOUTS,
  REAL_WORKOUTS,
  STREAK_DAY_WORKOUTS,
  countedWorkoutWhere,
  isCountedWorkout,
  type WorkoutCountPolicy,
  type WorkoutFacts,
} from '@/lib/stats/workout-definition';

const real: WorkoutFacts = {
  status: 'COMPLETED',
  completedAt: new Date('2026-09-20T10:00:00Z'),
  synthetic: false,
  completedModules: 3,
  ownerIsStaff: false,
};
const f = (patch: Partial<WorkoutFacts>): WorkoutFacts => ({ ...real, ...patch });

describe('ADMIN_STATS_WORKOUTS — решение владельца по п.6', () => {
  const p = ADMIN_STATS_WORKOUTS;

  it('завершённая и досрочно завершённая считаются', () => {
    expect(isCountedWorkout(real, p)).toBe(true);
    expect(isCountedWorkout(f({ status: 'PARTIAL', completedModules: 1 }), p)).toBe(true);
  });

  it('брошенные/незавершённые — нет', () => {
    for (const status of ['PENDING', 'IN_PROGRESS', 'SKIPPED']) {
      expect(isCountedWorkout(f({ status }), p)).toBe(false);
    }
    expect(isCountedWorkout(f({ completedAt: null }), p)).toBe(false);
  });

  it('синтетика админ-накрутки — нет', () => {
    expect(isCountedWorkout(f({ synthetic: true }), p)).toBe(false);
  });

  it('админы и тестеры (чит-сессии) — нет', () => {
    expect(isCountedWorkout(f({ ownerIsStaff: true }), p)).toBe(false);
  });

  it('закрытый день цикла (COMPLETED без модулей) — не дубль', () => {
    expect(isCountedWorkout(f({ completedModules: 0 }), p)).toBe(false);
  });
});

describe('другие пресеты', () => {
  it('REAL_WORKOUTS — то же, но команда не отсекается', () => {
    expect(isCountedWorkout(f({ ownerIsStaff: true }), REAL_WORKOUTS)).toBe(true);
    expect(isCountedWorkout(f({ synthetic: true }), REAL_WORKOUTS)).toBe(false);
    expect(isCountedWorkout(f({ completedModules: 0 }), REAL_WORKOUTS)).toBe(false);
  });

  it('STREAK_DAY_WORKOUTS — как trainingDayAts: синтетика и закрытый день дают день серии', () => {
    expect(isCountedWorkout(f({ synthetic: true, completedModules: 0 }), STREAK_DAY_WORKOUTS)).toBe(true);
    expect(isCountedWorkout(f({ status: 'SKIPPED' }), STREAK_DAY_WORKOUTS)).toBe(false);
  });
});

describe('countedWorkoutWhere', () => {
  it('админский where: статусы, без синтетики, ≥1 модуль, без команды', () => {
    expect(countedWorkoutWhere(ADMIN_STATS_WORKOUTS, { staffUserIds: ['a1', 't1'] })).toEqual({
      status: { in: ['COMPLETED', 'PARTIAL'] },
      completedAt: { not: null },
      synthetic: false,
      videos: { some: { completed: true } },
      userId: { notIn: ['a1', 't1'] },
    });
  });

  it('excludeStaff без списка команды — ошибка, а не тихий подсчёт админов', () => {
    expect(() => countedWorkoutWhere(ADMIN_STATS_WORKOUTS)).toThrow(/staffUserIds/);
  });

  it('пустой список команды — без фильтра по userId', () => {
    expect(countedWorkoutWhere(ADMIN_STATS_WORKOUTS, { staffUserIds: [] })).not.toHaveProperty('userId');
  });

  it('серия: только статусы и дата', () => {
    expect(countedWorkoutWhere(STREAK_DAY_WORKOUTS)).toEqual({
      status: { in: ['COMPLETED', 'PARTIAL'] },
      completedAt: { not: null },
    });
  });

  it('where и предикат — зеркала друг друга на всех комбинациях', () => {
    // Мини-интерпретатор ровно тех ключей, которые строит countedWorkoutWhere
    type W = ReturnType<typeof countedWorkoutWhere>;
    const matches = (w: W, s: WorkoutFacts & { userId: string }): boolean => {
      const st = w.status as { in: string[] };
      if (!st.in.includes(s.status)) return false;
      if (s.completedAt === null) return false;
      if (w.synthetic === false && s.synthetic) return false;
      if (w.videos && s.completedModules < 1) return false;
      const uid = w.userId as { notIn: string[] } | undefined;
      if (uid && uid.notIn.includes(s.userId)) return false;
      return true;
    };
    const policies: WorkoutCountPolicy[] = [ADMIN_STATS_WORKOUTS, REAL_WORKOUTS, STREAK_DAY_WORKOUTS];
    for (const policy of policies) {
      const where = countedWorkoutWhere(policy, { staffUserIds: ['staff'] });
      for (const status of ['COMPLETED', 'PARTIAL', 'PENDING', 'SKIPPED']) {
        for (const synthetic of [false, true]) {
          for (const completedModules of [0, 2]) {
            for (const ownerIsStaff of [false, true]) {
              for (const completedAt of [null, new Date()]) {
                const facts = { status, synthetic, completedModules, ownerIsStaff, completedAt };
                const withId = { ...facts, userId: ownerIsStaff ? 'staff' : 'athlete' };
                expect(matches(where, withId)).toBe(isCountedWorkout(facts, policy));
              }
            }
          }
        }
      }
    }
  });
});
