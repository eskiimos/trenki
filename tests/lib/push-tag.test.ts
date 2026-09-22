import { describe, expect, it } from 'vitest';
import { LEGACY_PUSH_TAG, pushTag, resolvePushTag } from '@/lib/notifications/push-tag';
import {
  assignmentDonePush,
  assignmentNewPush,
} from '@/lib/coach/assignment-push';
import { buildDailyReminder } from '@/lib/notifications/reminder-texts';

describe('push-tag — pushTag', () => {
  it('метка по типу, с префиксом приложения', () => {
    expect(pushTag('assignment-new')).toBe('trenki:assignment-new');
  });

  it('ключ разводит пуши одного типа', () => {
    expect(pushTag('assignment-done', 'u1')).toBe('trenki:assignment-done:u1');
    expect(pushTag('assignment-done', 'u1')).not.toBe(pushTag('assignment-done', 'u2'));
  });

  it('пустой ключ — как без ключа', () => {
    expect(pushTag('assignment-done', '')).toBe('trenki:assignment-done');
    expect(pushTag('assignment-done', '  ')).toBe('trenki:assignment-done');
    expect(pushTag('assignment-done', null)).toBe('trenki:assignment-done');
  });
});

describe('push-tag — напоминания и нуджи', () => {
  it('«через N минут тренировка»: одна метка на тренировку, разные тренировки — разные', () => {
    // Раннее и позднее напоминание шлются с одной меткой — позднее заменяет раннее.
    expect(pushTag('workout-soon', 'w1')).toBe(pushTag('workout-soon', 'w1'));
    expect(pushTag('workout-soon', 'w1')).not.toBe(pushTag('workout-soon', 'w2'));
    expect(
      resolvePushTag({ tag: pushTag('workout-soon', 'w1'), title: '⏰ Через 30 минут тренировка' }),
    ).toBe(
      resolvePushTag({ tag: pushTag('workout-soon', 'w1'), title: '🔥 Через 10 минут тренировка' }),
    );
  });

  it('ежедневное напоминание: разные варианты заголовка с явной меткой — одна метка', () => {
    // Ищем два дня, когда выпали разные варианты текста.
    const first = buildDailyReminder('2026-09-01', 'u1', 'Ваня', 'Сила');
    let other: ReturnType<typeof buildDailyReminder> | null = null;
    for (let d = 2; d <= 28 && !other; d++) {
      const r = buildDailyReminder(`2026-09-${String(d).padStart(2, '0')}`, 'u1', 'Ваня', 'Сила');
      if (r.title !== first.title) other = r;
    }
    expect(other).not.toBeNull();
    // По заголовку они разошлись бы — поэтому метка передаётся явно.
    expect(resolvePushTag({ title: first.title })).not.toBe(resolvePushTag({ title: other!.title }));
    const tag = pushTag('daily-reminder');
    expect(resolvePushTag({ tag, title: first.title })).toBe(resolvePushTag({ tag, title: other!.title }));
  });

  it('нуджи: метка по треку, треки не пересекаются', () => {
    const tags = new Set([pushTag('nudge-onboarding'), pushTag('nudge-streak'), pushTag('nudge-dusty')]);
    expect(tags.size).toBe(3);
    expect(tags.has(pushTag('daily-reminder'))).toBe(false);
  });
});

describe('push-tag — resolvePushTag', () => {
  it('явная метка — как есть', () => {
    expect(resolvePushTag({ tag: 'trenki:assignment-new', title: 'Что угодно' })).toBe(
      'trenki:assignment-new',
    );
  });

  it('без метки — по заголовку: одинаковые пуши заменяют друг друга, разные — нет', () => {
    const streak1 = resolvePushTag({ title: '🔥 Серия под угрозой!' });
    const streak2 = resolvePushTag({ title: '🔥  Серия под угрозой! ' });
    const dusty = resolvePushTag({ title: 'Гантели уже запылились! 🏋️' });
    expect(streak1).toBe(streak2);
    expect(streak1).not.toBe(dusty);
    expect(streak1).not.toBe(LEGACY_PUSH_TAG);
  });

  it('метка по заголовку не пересекается с метками типов', () => {
    expect(resolvePushTag({ title: 'assignment-new' })).not.toBe(pushTag('assignment-new'));
  });

  it('ни метки, ни заголовка — прежняя общая метка (пустой tag в SW недопустим)', () => {
    expect(resolvePushTag({})).toBe(LEGACY_PUSH_TAG);
    expect(resolvePushTag({ tag: '  ', title: '  ' })).toBe(LEGACY_PUSH_TAG);
  });

  it('длинная метка режется по символам, не разрывая эмодзи', () => {
    const tag = resolvePushTag({ title: '💪'.repeat(300) });
    expect(Array.from(tag).length).toBe(120);
    // Нет «висячих» половинок суррогатной пары.
    expect(tag).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/);
  });
});

describe('assignment-push', () => {
  it('новое задание: текст владельца, ссылка на задания, своя метка', () => {
    const p = assignmentNewPush();
    expect(p.title).toBe('Задание от тренера!');
    expect(p.body).toBe(
      'Привет, чемпион! Тебе прилетела тренировка от тренера. Вперёд к выполнению 💪',
    );
    expect(p.url).toBe('/profile/assignments');
    expect(p.tag).toBe(pushTag('assignment-new'));
  });

  it('задание выполнено: метка на атлета, чтобы разные атлеты не затирали друг друга', () => {
    const a = assignmentDonePush({ id: 'a1', name: 'Ваня Петров' });
    const b = assignmentDonePush({ id: 'a2', name: 'Петя Иванов' });
    expect(a.body).toBe('Ваня Петров закрыл назначенную тренировку');
    expect(a.url).toBe('/coach/assignments');
    expect(a.tag).not.toBe(b.tag);
    expect(a.tag).not.toBe(assignmentNewPush().tag);
  });
});
