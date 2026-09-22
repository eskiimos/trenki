import { describe, it, expect } from 'vitest';
import {
  TASK_DUE_DAYS,
  TASK_MAX_ACTIVE_PER_CHILD,
  parentTaskPush,
  relationWords,
  taskCompletedEmail,
  taskDisplayState,
  taskDueDate,
  taskProgressLabel,
  validateNewTask,
} from '../../src/lib/parent-tasks';

const ok = { goal: 'POWERFUL_SHOT', target: 3, relation: 'MOTHER' };

describe('relationWords', () => {
  it('мама / папа / родитель — с правильным родом глагола', () => {
    expect(relationWords('MOTHER').gave).toBe('Мама дала задание');
    expect(relationWords('FATHER').gave).toBe('Папа дал задание');
    expect(relationWords('OTHER').gave).toBe('Задание от родителя');
    expect(relationWords(null).gave).toBe('Задание от родителя');
  });
});

describe('taskProgressLabel', () => {
  it('«Мощный бросок · 1/3», перебор не показываем', () => {
    expect(taskProgressLabel('POWERFUL_SHOT', 1, 3)).toBe('Мощный бросок · 1/3');
    expect(taskProgressLabel('POWERFUL_SHOT', 5, 3)).toBe('Мощный бросок · 3/3');
  });

  it('неизвестная цель — нейтральная подпись', () => {
    expect(taskProgressLabel('???', 0, 2)).toBe('Тренировка · 0/2');
  });
});

describe('taskDisplayState', () => {
  const now = new Date('2026-09-21T12:00:00Z');
  it('статус из БД важнее срока', () => {
    expect(taskDisplayState({ status: 'COMPLETED', dueDate: '2026-09-01T00:00:00Z' }, now)).toBe('completed');
    expect(taskDisplayState({ status: 'CANCELED', dueDate: '2026-10-01T00:00:00Z' }, now)).toBe('canceled');
  });
  it('активное с прошедшим сроком — «срок вышел»', () => {
    expect(taskDisplayState({ status: 'ACTIVE', dueDate: '2026-09-20T00:00:00Z' }, now)).toBe('expired');
    expect(taskDisplayState({ status: 'ACTIVE', dueDate: new Date('2026-09-25T00:00:00Z') }, now)).toBe('active');
  });
});

describe('taskDueDate', () => {
  it('срок — неделя от выдачи', () => {
    const now = new Date('2026-09-21T12:00:00Z');
    expect(taskDueDate(now).getTime() - now.getTime()).toBe(TASK_DUE_DAYS * 24 * 60 * 60 * 1000);
  });
});

describe('validateNewTask', () => {
  it('корректное задание проходит', () => {
    expect(validateNewTask(ok, [])).toBeNull();
  });

  it('неизвестная цель', () => {
    expect(validateNewTask({ ...ok, goal: 'HACK' }, [])).toBe('Выберите цель');
    expect(validateNewTask({ ...ok, goal: 42 }, [])).toBe('Выберите цель');
  });

  it('число тренировок — целое от 1 до 5', () => {
    expect(validateNewTask({ ...ok, target: 0 }, [])).toMatch(/от 1 до 5/);
    expect(validateNewTask({ ...ok, target: 6 }, [])).toMatch(/от 1 до 5/);
    expect(validateNewTask({ ...ok, target: 2.5 }, [])).toMatch(/от 1 до 5/);
    expect(validateNewTask({ ...ok, target: 'abc' }, [])).toMatch(/от 1 до 5/);
    expect(validateNewTask({ ...ok, target: '2' }, [])).toBeNull();
  });

  it('кто даёт задание — только из списка', () => {
    expect(validateNewTask({ ...ok, relation: 'GRANDMA' }, [])).toBe('Укажите, кто даёт задание');
    expect(validateNewTask({ ...ok, relation: undefined }, [])).toBe('Укажите, кто даёт задание');
  });

  it('на одну цель — одно активное задание', () => {
    expect(validateNewTask(ok, ['POWERFUL_SHOT'])).toMatch(/уже есть/);
  });

  it('не больше трёх активных заданий', () => {
    const active = ['OUTRUN_OPPONENT', 'STRENGTH_STABILITY', 'X'].slice(0, TASK_MAX_ACTIVE_PER_CHILD);
    expect(validateNewTask(ok, active)).toMatch(/Не больше 3/);
  });
});

describe('parentTaskPush', () => {
  it('заголовок по тому, кто дал задание', () => {
    expect(parentTaskPush('MOTHER').title).toBe('Задание от мамы!');
    expect(parentTaskPush('FATHER').title).toBe('Задание от папы!');
    expect(parentTaskPush('OTHER').title).toBe('Задание от родителя!');
  });
  it('текст как в ТЗ', () => {
    expect(parentTaskPush('MOTHER').body).toBe('Привет, чемпион! Тебе прилетела тренировка от мамы. Вперёд к выполнению 💪');
  });
});

describe('taskCompletedEmail', () => {
  const mail = taskCompletedEmail({
    childName: '<b>Миша</b>',
    goal: 'POWERFUL_SHOT',
    target: 3,
    unsubscribeUrl: 'https://trenki.app/u?a=1&b=2',
  });

  it('тема без рода и склонения имени', () => {
    expect(mail.subject).toBe('Задание выполнено: Мощный бросок — <b>Миша</b>');
  });

  it('html экранирует имя, есть ссылка отписки', () => {
    expect(mail.html).not.toContain('<b>Миша</b>');
    expect(mail.html).toContain('&lt;b&gt;Миша&lt;/b&gt;');
    expect(mail.html).toContain('a=1&amp;b=2');
    expect(mail.html).toContain('trenki.app/parent');
  });

  it('text содержит итог и ссылку отписки', () => {
    expect(mail.text).toContain('3 из 3 тренировок на цель «Мощный бросок»');
    expect(mail.text).toContain('Отписаться: https://trenki.app/u?a=1&b=2');
  });
});

describe('taskCompletedEmail — падеж', () => {
  it('«из 1 тренировки», «из 5 тренировок»', () => {
    const one = taskCompletedEmail({ childName: 'Саша', goal: 'POWERFUL_SHOT', target: 1, unsubscribeUrl: 'u' });
    expect(one.text).toContain('1 из 1 тренировки');
    const five = taskCompletedEmail({ childName: 'Саша', goal: 'POWERFUL_SHOT', target: 5, unsubscribeUrl: 'u' });
    expect(five.text).toContain('5 из 5 тренировок');
  });
});
