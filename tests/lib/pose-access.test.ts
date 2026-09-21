import { describe, expect, it } from 'vitest';
import {
  canReviewPoseSession,
  canViewPoseSession,
  resolvePoseListScope,
} from '@/lib/pose-access';

const athlete = { id: 'athlete-1', role: 'ATHLETE' };
const coach = { id: 'coach-1', role: 'COACH' };
const parent = { id: 'parent-1', role: 'PARENT' };

describe('pose-access — resolvePoseListScope', () => {
  it('атлет всегда видит только свои, ?athleteId игнорируется', () => {
    expect(resolvePoseListScope(athlete, null)).toEqual({ kind: 'own' });
    expect(resolvePoseListScope(athlete, 'athlete-2')).toEqual({ kind: 'own' });
  });

  it('родитель — тоже только свои (детские сессии через этот роут не открываются)', () => {
    expect(resolvePoseListScope(parent, 'athlete-1')).toEqual({ kind: 'own' });
  });

  it('тренер без ?athleteId — атлеты его команд, а не вся база (был IDOR)', () => {
    expect(resolvePoseListScope(coach, null)).toEqual({ kind: 'coach-teams' });
    expect(resolvePoseListScope(coach, '')).toEqual({ kind: 'coach-teams' });
    expect(resolvePoseListScope(coach, '   ')).toEqual({ kind: 'coach-teams' });
  });

  it('тренер с ?athleteId — конкретный атлет, требует проверки команды', () => {
    expect(resolvePoseListScope(coach, ' athlete-1 ')).toEqual({
      kind: 'coach-athlete',
      athleteId: 'athlete-1',
    });
  });

  it('тренер со своим id — свои сессии без проверки команды', () => {
    expect(resolvePoseListScope(coach, 'coach-1')).toEqual({ kind: 'own' });
  });
});

describe('pose-access — canViewPoseSession', () => {
  it('владелец видит свою сессию', () => {
    expect(canViewPoseSession(athlete, 'athlete-1', false)).toBe(true);
    expect(canViewPoseSession(coach, 'coach-1', false)).toBe(true);
  });

  it('чужой атлет не видит, даже если флаг тренера почему-то true', () => {
    expect(canViewPoseSession(athlete, 'athlete-2', false)).toBe(false);
    expect(canViewPoseSession(athlete, 'athlete-2', true)).toBe(false);
    expect(canViewPoseSession(parent, 'athlete-1', true)).toBe(false);
  });

  it('тренер видит только атлета своей команды', () => {
    expect(canViewPoseSession(coach, 'athlete-1', true)).toBe(true);
    expect(canViewPoseSession(coach, 'athlete-1', false)).toBe(false);
  });
});

describe('pose-access — canReviewPoseSession', () => {
  it('тренер оценивает атлета своей команды', () => {
    expect(canReviewPoseSession(coach, 'athlete-1', true)).toBe(true);
  });

  it('тренер не оценивает чужого атлета', () => {
    expect(canReviewPoseSession(coach, 'athlete-1', false)).toBe(false);
  });

  it('свою сессию тренер не оценивает', () => {
    expect(canReviewPoseSession(coach, 'coach-1', true)).toBe(false);
  });

  it('не тренер не оценивает никогда', () => {
    expect(canReviewPoseSession(athlete, 'athlete-1', true)).toBe(false);
    expect(canReviewPoseSession(athlete, 'athlete-2', true)).toBe(false);
    expect(canReviewPoseSession(parent, 'athlete-1', true)).toBe(false);
  });
});
