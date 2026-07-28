import { describe, it, expect } from 'vitest';
import {
  DAILY_REMINDER_VARIANTS,
  pickReminderVariantIndex,
  buildDailyReminder,
} from '../../src/lib/notifications/reminder-texts';

describe('pickReminderVariantIndex', () => {
  it('детерминирован: тот же день + юзер → тот же вариант', () => {
    const a = pickReminderVariantIndex('2026-07-20', 'u1', 2);
    const b = pickReminderVariantIndex('2026-07-20', 'u1', 2);
    expect(a).toBe(b);
  });

  it('всегда в границах массива', () => {
    for (let d = 1; d <= 28; d += 1) {
      const date = `2026-07-${String(d).padStart(2, '0')}`;
      const idx = pickReminderVariantIndex(date, 'user-x', DAILY_REMINDER_VARIANTS.length);
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(DAILY_REMINDER_VARIANTS.length);
    }
  });

  it('за месяц юзер видит оба варианта (нет залипания на одном)', () => {
    const seen = new Set<number>();
    for (let d = 1; d <= 28; d += 1) {
      seen.add(pickReminderVariantIndex(`2026-07-${String(d).padStart(2, '0')}`, 'user-x', 2));
    }
    expect(seen.size).toBe(2);
  });

  it('одиночный вариант не делит на ноль', () => {
    expect(pickReminderVariantIndex('2026-07-20', 'u1', 1)).toBe(0);
  });
});

describe('buildDailyReminder', () => {
  it('подставляет имя и метку дня', () => {
    // Перебираем даты, пока не встретим оба варианта — проверяем формат каждого.
    const texts = new Set<string>();
    for (let d = 1; d <= 28; d += 1) {
      const t = buildDailyReminder(`2026-07-${String(d).padStart(2, '0')}`, 'u1', 'Иван', 'Разминка');
      expect(t.body).toContain('Разминка');
      expect(t.title.length).toBeGreaterThan(0);
      texts.add(t.title);
    }
    // Оба заголовка содержат имя
    for (const t of texts) expect(t).toContain('Иван');
    expect(texts.size).toBe(2);
  });

  it('без имени заголовок остаётся валидным', () => {
    const t = buildDailyReminder('2026-07-20', 'u1', null, 'В тонусе');
    expect(t.title).not.toContain('null');
    expect(t.body).toContain('В тонусе');
  });
});
