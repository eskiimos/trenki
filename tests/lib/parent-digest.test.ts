import { describe, it, expect } from 'vitest';
import { buildParentDigest, formatWeekLabel, gainsLine, type DigestChild } from '../../src/lib/parent-digest';

const child = (over: Partial<DigestChild> = {}): DigestChild => ({
  name: 'Миша Петров',
  statusTitle: 'Перспектива',
  statusEmoji: '⛸️',
  level: 7,
  streak: 0,
  weekWorkouts: 3,
  weekModules: 12,
  potential: 42.6,
  ...over,
});

describe('buildParentDigest', () => {
  it('null при пустой неделе у ВСЕХ детей (0 тренировок и 0 модулей)', () => {
    const d = buildParentDigest({
      children: [
        child({ weekWorkouts: 0, weekModules: 0 }),
        child({ name: 'Саша', weekWorkouts: 0, weekModules: 0 }),
      ],
      weekLabel: '1–7 августа',
    });
    expect(d).toBeNull();
  });

  it('null без детей вовсе', () => {
    expect(buildParentDigest({ children: [], weekLabel: '1–7 августа' })).toBeNull();
  });

  it('шлётся, если хоть у одного ребёнка есть активность', () => {
    const d = buildParentDigest({
      children: [
        child({ weekWorkouts: 0, weekModules: 0 }),
        child({ name: 'Саша', weekWorkouts: 0, weekModules: 1 }),
      ],
      weekLabel: '1–7 августа',
    });
    expect(d).not.toBeNull();
    // Пассивный ребёнок тоже в отчёте — родитель видит общую картину
    expect(d!.html).toContain('Миша Петров');
    expect(d!.html).toContain('Саша');
  });

  it('subject содержит имена детей через запятую', () => {
    const d = buildParentDigest({
      children: [child(), child({ name: 'Саша Иванов' })],
      weekLabel: '1–7 августа',
    });
    expect(d!.subject).toBe('Итоги недели: Миша Петров, Саша Иванов');
  });

  it('стрик-блок есть при streak >= 2 и отсутствует при streak < 2', () => {
    const withStreak = buildParentDigest({
      children: [child({ streak: 3 })],
      weekLabel: '1–7 августа',
    });
    expect(withStreak!.html).toContain('Серия');
    expect(withStreak!.html).toContain('3 дня подряд');
    expect(withStreak!.text).toContain('Серия: 3 дня подряд');

    const single = buildParentDigest({
      children: [child({ streak: 1 })],
      weekLabel: '1–7 августа',
    });
    expect(single!.html).not.toContain('Серия');
    expect(single!.text).not.toContain('Серия');
  });

  it('html содержит уровень, звание и активность за неделю', () => {
    const d = buildParentDigest({ children: [child()], weekLabel: '1–7 августа' });
    expect(d!.html).toContain('Уровень 7');
    expect(d!.html).toContain('Перспектива');
    expect(d!.html).toContain('3 тренировки');
    expect(d!.html).toContain('12 модулей');
    expect(d!.html).toContain('1–7 августа');
    // Потенциал округляется
    expect(d!.html).toContain('Потенциал');
    expect(d!.html).toContain('43');
    // Подпись
    expect(d!.html).toContain('trenki.app');
    expect(d!.text).toContain('Приложение Треньки — trenki.app');
  });

  it('потенциал null отображается прочерком', () => {
    const d = buildParentDigest({
      children: [child({ potential: null })],
      weekLabel: '1–7 августа',
    });
    expect(d!.text).toContain('Потенциал: —');
  });

  it('экранирует HTML в имени ребёнка', () => {
    const d = buildParentDigest({
      children: [child({ name: '<script>alert(1)</script>' })],
      weekLabel: '1–7 августа',
    });
    expect(d!.html).not.toContain('<script>');
    expect(d!.html).toContain('&lt;script&gt;');
  });
});

describe('formatWeekLabel', () => {
  it('внутри одного месяца — короткий диапазон', () => {
    // 7 августа 12:00 МСК → неделя 1–7 августа
    expect(formatWeekLabel(new Date('2026-08-07T09:00:00Z'))).toBe('1–7 августа');
  });

  it('через границу месяца — оба месяца', () => {
    // 3 августа → неделя 28 июля — 3 августа
    expect(formatWeekLabel(new Date('2026-08-03T09:00:00Z'))).toBe('28 июля — 3 августа');
  });
});

describe('buildParentDigest — рост и задания (п.9а «Середина сентября»)', () => {
  const gains = { power: 1.24, speed: 0.8, endurance: 0, technique: 0.04, flexibility: 0.5, potential: 0.52 };

  it('строка роста: только ненулевые приросты, запятая как разделитель', () => {
    expect(gainsLine(gains)).toBe('Сила +1,2 · Скорость +0,8 · Гибкость +0,5');
    expect(gainsLine({ power: 0, speed: 0, endurance: 0, technique: 0.02, flexibility: 0, potential: 0 })).toBeNull();
    expect(gainsLine(undefined)).toBeNull();
  });

  it('рост и прирост потенциала попадают в html и text', () => {
    const d = buildParentDigest({ children: [child({ gains })], weekLabel: '1–7 августа' });
    expect(d!.html).toContain('Рост');
    expect(d!.html).toContain('Сила +1,2');
    expect(d!.html).toContain('(+0,5 за неделю)');
    expect(d!.text).toContain('Рост: Сила +1,2 · Скорость +0,8 · Гибкость +0,5');
    expect(d!.text).toContain('Потенциал: 43 (+0,5 за неделю)');
  });

  it('без роста блока нет', () => {
    const d = buildParentDigest({ children: [child()], weekLabel: '1–7 августа' });
    expect(d!.html).not.toContain('Рост');
    expect(d!.text).not.toContain('Рост');
  });

  it('задания: прогресс и выполненные', () => {
    const d = buildParentDigest({
      children: [
        child({
          tasks: [
            { goalLabel: 'Мощный бросок', done: 1, target: 3, completed: false },
            { goalLabel: 'Скорость', done: 2, target: 2, completed: true },
            { goalLabel: 'Гибкость', done: 0, target: 2, completed: false, expired: true },
          ],
        }),
      ],
      weekLabel: '1–7 августа',
    });
    expect(d!.text).toContain(
      'Задания: «Мощный бросок» — 1 из 3; «Скорость» — выполнено (2 из 2); «Гибкость» — 0 из 2, срок вышел',
    );
    expect(d!.html).toContain('Задания');
  });

  it('прогресс по заданию без тренировок недели — письмо всё равно уходит', () => {
    const d = buildParentDigest({
      children: [
        child({
          weekWorkouts: 0,
          weekModules: 0,
          tasks: [{ goalLabel: 'Скорость', done: 2, target: 2, completed: true }],
        }),
      ],
      weekLabel: '1–7 августа',
    });
    expect(d).not.toBeNull();
  });

  it('задание без прогресса при пустой неделе — письма нет', () => {
    const d = buildParentDigest({
      children: [
        child({
          weekWorkouts: 0,
          weekModules: 0,
          tasks: [{ goalLabel: 'Скорость', done: 0, target: 2, completed: false }],
        }),
      ],
      weekLabel: '1–7 августа',
    });
    expect(d).toBeNull();
  });

  it('ссылка отписки в html и text, если передана', () => {
    const url = 'https://trenki.app/api/email/unsubscribe?u=abc&t=x';
    const d = buildParentDigest({ children: [child()], weekLabel: '1–7 августа', unsubscribeUrl: url });
    expect(d!.html).toContain('Отписаться');
    expect(d!.html).toContain('u=abc&amp;t=x');
    expect(d!.text).toContain(`Отписаться: ${url}`);

    const without = buildParentDigest({ children: [child()], weekLabel: '1–7 августа' });
    expect(without!.html).not.toContain('Отписаться');
  });
});
