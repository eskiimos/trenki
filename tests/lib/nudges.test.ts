import { describe, it, expect } from 'vitest';
import { decideNudge, ONBOARDING_DRIP, DUSTY_AFTER_DAYS } from '../../src/lib/notifications/nudges';

const NOW = new Date('2026-07-20T12:00:00Z');
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000);

const base = {
  createdAt: daysAgo(30),
  everTrained: true,
  daysSinceLastTraining: 0,
  hasPremium: false,
  nudgeStep: 0,
  daysSinceLastDusty: null,
};

describe('онбординг-дрип (ни разу не тренировался)', () => {
  it('в день регистрации молчит', () => {
    expect(decideNudge({ ...base, createdAt: NOW, everTrained: false, daysSinceLastTraining: null }, NOW)).toBeNull();
  });

  it('на 1-й день шлёт первый шаг', () => {
    const d = decideNudge({ ...base, createdAt: daysAgo(1), everTrained: false, daysSinceLastTraining: null }, NOW);
    expect(d?.kind).toBe('onboarding');
    expect(d?.nextStep).toBe(1);
  });

  it('не повторяет уже отправленный шаг', () => {
    const d = decideNudge(
      { ...base, createdAt: daysAgo(1), everTrained: false, daysSinceLastTraining: null, nudgeStep: 1 },
      NOW,
    );
    expect(d).toBeNull();
  });

  it('на 3-й день идёт второй шаг', () => {
    const d = decideNudge(
      { ...base, createdAt: daysAgo(3), everTrained: false, daysSinceLastTraining: null, nudgeStep: 1 },
      NOW,
    );
    expect(d?.nextStep).toBe(2);
  });

  it('после всех шагов замолкает', () => {
    const d = decideNudge(
      {
        ...base,
        createdAt: daysAgo(60),
        everTrained: false,
        daysSinceLastTraining: null,
        nudgeStep: ONBOARDING_DRIP.length,
      },
      NOW,
    );
    expect(d).toBeNull();
  });

  it('новичку НЕ шлём «гантели запылились» (он ещё не начинал)', () => {
    const d = decideNudge({ ...base, createdAt: daysAgo(10), everTrained: false, daysSinceLastTraining: null }, NOW);
    expect(d?.kind).toBe('onboarding');
  });
});

describe('нудж «гантели запылились»', () => {
  it('молчит, если тренировался недавно', () => {
    expect(decideNudge({ ...base, daysSinceLastTraining: 1 }, NOW)).toBeNull();
  });

  it('шлёт после простоя', () => {
    const d = decideNudge({ ...base, daysSinceLastTraining: DUSTY_AFTER_DAYS }, NOW);
    expect(d?.kind).toBe('dusty');
    expect(d?.text.title).toContain('Гантели');
  });

  it('НЕ шлёт подписчику (это нудж для тех, кто без подписки)', () => {
    const d = decideNudge({ ...base, daysSinceLastTraining: 10, hasPremium: true }, NOW);
    expect(d).toBeNull();
  });

  it('НЕ повторяется на следующий день после отправки', () => {
    const d = decideNudge({ ...base, daysSinceLastTraining: 10, daysSinceLastDusty: 1 }, NOW);
    expect(d).toBeNull();
  });

  it('повторяется, когда интервал выдержан', () => {
    const d = decideNudge({ ...base, daysSinceLastTraining: 10, daysSinceLastDusty: DUSTY_AFTER_DAYS }, NOW);
    expect(d?.kind).toBe('dusty');
  });

  it('не трогает nudgeStep дрипа', () => {
    const d = decideNudge({ ...base, daysSinceLastTraining: 10, nudgeStep: 2 }, NOW);
    expect(d?.nextStep).toBe(2);
  });
});
