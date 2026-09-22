import { describe, it, expect } from 'vitest';
import {
  allowedOnReminderDay,
  decideNudge,
  inNudgeWindow,
  DUSTY_AFTER_DAYS,
  MISSED_AFTER_DAYS,
  ONBOARDING_DRIP,
  trainingRecency,
} from '../../src/lib/notifications/nudges';
import { DEFAULT_PUSH_TEMPLATES } from '../../src/lib/notifications/templates';

const NOW = new Date('2026-07-20T12:00:00Z');
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000);

const base = {
  createdAt: daysAgo(30),
  everTrained: true,
  daysSinceLastTraining: 0,
  hasPremium: false,
  nudgeStep: 0,
  daysSinceLastDusty: null,
  currentStreak: 0,
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

describe('нудж «серия под угрозой»', () => {
  it('шлёт при стрике ≥ 2 и простое ровно 1 день', () => {
    const d = decideNudge({ ...base, currentStreak: 3, daysSinceLastTraining: 1 }, NOW);
    expect(d?.kind).toBe('streak');
    expect(d?.text.title).toBe('🔥 Твоя серия — 3 дня. Не разрывай её!');
  });

  it('молчит, если тренировался сегодня (daysSince=0 — серия не под угрозой)', () => {
    expect(decideNudge({ ...base, currentStreak: 3, daysSinceLastTraining: 0 }, NOW)).toBeNull();
  });

  it('молчит при стрике < 2 (один день — ещё не серия)', () => {
    expect(decideNudge({ ...base, currentStreak: 1, daysSinceLastTraining: 1 }, NOW)).toBeNull();
  });

  it('шлёт и подписчику: стрик не про подписку', () => {
    const d = decideNudge({ ...base, currentStreak: 2, daysSinceLastTraining: 1, hasPremium: true }, NOW);
    expect(d?.kind).toBe('streak');
  });

  it('не пересекается с dusty: стрик — при простое 1 день, dusty — от 4', () => {
    // Простой 1 день — стрик (dusty ещё не созрел).
    const atOne = decideNudge({ ...base, currentStreak: 2, daysSinceLastTraining: 1 }, NOW);
    expect(atOne?.kind).toBe('streak');
    // Простой 4+ дней — стрик уже мёртв (computeStreak даст 0), работает dusty.
    const atFour = decideNudge({ ...base, currentStreak: 0, daysSinceLastTraining: DUSTY_AFTER_DAYS }, NOW);
    expect(atFour?.kind).toBe('dusty');
  });

  it('склоняет дни: 5 дней', () => {
    const d = decideNudge({ ...base, currentStreak: 5, daysSinceLastTraining: 1 }, NOW);
    expect(d?.text.title).toContain('5 дней');
  });

  it('при стрике ≥ 3 предупреждает, что сгорит «Ударный темп»', () => {
    const d = decideNudge({ ...base, currentStreak: 3, daysSinceLastTraining: 1 }, NOW);
    expect(d?.text.body).toContain('ударный темп (×2 к опыту)');
  });

  it('при стрике 2 темп ещё не активен — про ×2 молчит', () => {
    const d = decideNudge({ ...base, currentStreak: 2, daysSinceLastTraining: 1 }, NOW);
    expect(d?.text.body).not.toContain('×2');
  });

  it('не трогает nudgeStep дрипа', () => {
    const d = decideNudge({ ...base, currentStreak: 2, daysSinceLastTraining: 1, nudgeStep: 2 }, NOW);
    expect(d?.nextStep).toBe(2);
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

describe('нудж «пропуск 2 дня»', () => {
  it('шлёт ровно на второй день без тренировок — и с подпиской тоже', () => {
    const d = decideNudge({ ...base, name: 'Миша', daysSinceLastTraining: MISSED_AFTER_DAYS, hasPremium: true }, NOW);
    expect(d?.kind).toBe('missed');
    expect(d?.template).toBe('missed');
    expect(d?.text.title).toBe('Миша, ты не тренировался 2 дня');
    expect(d?.text.url).toBe('/training/assessment');
  });

  it('без имени — «Чемпион, …» с заглавной', () => {
    const d = decideNudge({ ...base, daysSinceLastTraining: MISSED_AFTER_DAYS }, NOW);
    expect(d?.text.title).toBe('Чемпион, ты не тренировался 2 дня');
  });

  it('на 1-й и 3-й день молчит (серия и «запылились» — другие сценарии)', () => {
    expect(decideNudge({ ...base, daysSinceLastTraining: 1, currentStreak: 1 }, NOW)).toBeNull();
    expect(decideNudge({ ...base, daysSinceLastTraining: 3 }, NOW)).toBeNull();
  });

  it('новичку не шлётся: у него онбординг', () => {
    const d = decideNudge({ ...base, everTrained: false, daysSinceLastTraining: null, createdAt: daysAgo(2) }, NOW);
    expect(d?.kind).toBe('onboarding');
  });
});

describe('шаблоны из админки', () => {
  it('decideNudge берёт переданные тексты и подставляет переменные', () => {
    const templates = {
      ...DEFAULT_PUSH_TEMPLATES,
      streak: { title: '{name}, серия {streak}!', body: 'Держись' },
    };
    const d = decideNudge({ ...base, name: 'Петя', currentStreak: 2, daysSinceLastTraining: 1 }, NOW, templates);
    expect(d?.template).toBe('streak');
    expect(d?.text.title).toBe('Петя, серия 2 дня!');
  });

  it('серия ≥ 3 — отдельный шаблон с «ударным темпом»', () => {
    const d = decideNudge({ ...base, currentStreak: 4, daysSinceLastTraining: 1 }, NOW);
    expect(d?.template).toBe('streakTempo');
  });

  it('онбординг — шаблон по шагу', () => {
    const d = decideNudge({ ...base, createdAt: daysAgo(3), everTrained: false, daysSinceLastTraining: null, nudgeStep: 1 }, NOW);
    expect(d?.template).toBe('onboarding2');
    expect(d?.text.url).toBe(ONBOARDING_DRIP[1]!.url);
  });
});

describe('trainingRecency — календарные дни по таймзоне (Б1/Б3)', () => {
  const TZ = 'Europe/Moscow';

  it('тренировался вчера вечером, сейчас 18:00 — простой 1 день, серия жива', () => {
    // Раньше: 23 часа → «0 дней» и пуш «серия под угрозой» не уходил никогда
    const now = new Date('2026-09-22T15:00:00Z'); // 18:00 МСК
    const r = trainingRecency(
      [new Date('2026-09-21T16:00:00Z'), new Date('2026-09-20T16:00:00Z')], // вчера и позавчера 19:00 МСК
      now,
      TZ,
    );
    expect(r).toEqual({ everTrained: true, daysSinceLastTraining: 1, currentStreak: 2 });
    expect(decideNudge({ ...base, ...r }, now)?.kind).toBe('streak');
  });

  it('тренировался сегодня — простой 0, нуджа нет', () => {
    const now = new Date('2026-09-22T15:00:00Z');
    const r = trainingRecency([new Date('2026-09-22T06:00:00Z')], now, TZ);
    expect(r.daysSinceLastTraining).toBe(0);
    expect(decideNudge({ ...base, ...r }, now)).toBeNull();
  });

  it('последняя тренировка позавчера — «пропуск 2 дня»', () => {
    const now = new Date('2026-09-22T15:00:00Z');
    const r = trainingRecency([new Date('2026-09-20T18:30:00Z')], now, TZ); // 20.09 21:30 МСК
    expect(r.daysSinceLastTraining).toBe(2);
    expect(r.currentStreak).toBe(0);
    expect(decideNudge({ ...base, ...r }, now)?.kind).toBe('missed');
  });

  it('день считается по таймзоне игрока, а не сервера', () => {
    // 21.09 23:30 по Владивостоку = 21.09 13:30 UTC; сейчас 22.09 18:00 по Владивостоку
    const now = new Date('2026-09-22T08:00:00Z');
    const r = trainingRecency([new Date('2026-09-21T13:30:00Z')], now, 'Asia/Vladivostok');
    expect(r.daysSinceLastTraining).toBe(1);
  });

  it('без тренировок — новичок', () => {
    expect(trainingRecency([], NOW, TZ)).toEqual({ everTrained: false, daysSinceLastTraining: null, currentStreak: 0 });
  });
});

describe('день утреннего напоминания по циклу (Б4)', () => {
  it('серию пропускаем, остальное — нет', () => {
    expect(allowedOnReminderDay('streak')).toBe(true);
    expect(allowedOnReminderDay('missed')).toBe(false);
    expect(allowedOnReminderDay('dusty')).toBe(false);
    expect(allowedOnReminderDay('onboarding')).toBe(false);
  });
});

describe('онбординг — календарные дни', () => {
  it('зарегистрировался вчера в 20:00, сегодня 18:00 — уже первый шаг', () => {
    const now = new Date('2026-09-22T15:00:00Z'); // 18:00 МСК
    const d = decideNudge(
      { ...base, tz: 'Europe/Moscow', createdAt: new Date('2026-09-21T17:00:00Z'), everTrained: false, daysSinceLastTraining: null },
      now,
    );
    expect(d?.template).toBe('onboarding1');
  });

  it('в день регистрации молчит, даже если прошло много часов', () => {
    const now = new Date('2026-09-22T20:00:00Z'); // 23:00 МСК
    const d = decideNudge(
      { ...base, tz: 'Europe/Moscow', createdAt: new Date('2026-09-21T21:30:00Z'), everTrained: false, daysSinceLastTraining: null },
      now,
    );
    expect(d).toBeNull();
  });
});

describe('окно вечерних пушей', () => {
  const at = (h: number, m = 0) => h * 60 + m;
  it('с начала окна и три часа после', () => {
    expect(inNudgeWindow(at(17, 59), at(18))).toBe(false);
    expect(inNudgeWindow(at(18), at(18))).toBe(true);
    expect(inNudgeWindow(at(20, 59), at(18))).toBe(true);
    expect(inNudgeWindow(at(21), at(18))).toBe(false);
  });
  it('не позже 22:00, даже если окно начинается в 21:00', () => {
    expect(inNudgeWindow(at(21, 30), at(21))).toBe(true);
    expect(inNudgeWindow(at(22), at(21))).toBe(false);
    expect(inNudgeWindow(at(23, 30), at(21))).toBe(false);
  });
});
