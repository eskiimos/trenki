import { describe, it, expect } from 'vitest';
import {
  nicknameFor,
  plausibleNameFor,
  buildStandings,
  isoWeekLabel,
  type LeagueEntry,
} from '../../src/lib/league';

const e = (userId: string, weeklyXp: number): LeagueEntry => ({ userId, weeklyXp });

describe('nicknameFor', () => {
  it('стабилен для одного userId и различен для разных', () => {
    const a1 = nicknameFor('user-a');
    const a2 = nicknameFor('user-a');
    const b = nicknameFor('user-b');
    expect(a1).toEqual(a2);
    expect(a1.name).not.toBe(b.name);
  });
  it('не содержит реального имени/идентификатора', () => {
    const n = nicknameFor('cmkzafdw40000k004i9wc0zgc');
    expect(n.name).not.toContain('cmkz');
  });
});

describe('plausibleNameFor', () => {
  it('формат «Имя И.», стабилен для одного сида, различен для разных', () => {
    const a1 = plausibleNameFor('user-a');
    expect(a1).toMatch(/^[А-ЯЁ][а-яё]+ [А-ЯЁ]\.$/);
    expect(plausibleNameFor('user-a')).toBe(a1);
    // при 256 комбинациях коллизии возможны, но конкретная пара сидов различима
    expect(plausibleNameFor('user-b2')).not.toBe(a1);
  });
});

describe('buildStandings', () => {
  const CHILD = 'child-1';

  it('null, если ребёнка нет среди участников', () => {
    expect(buildStandings([e('x', 10)], CHILD, 'Миша', 'w')).toBeNull();
  });

  it('свой — реальным именем и isOwn, чужие — обезличенные «Имя И.» от userId', () => {
    const s = buildStandings([e(CHILD, 300), e('a', 500), e('b', 100)], CHILD, 'Миша', 'w')!;
    const own = s.rows.find((r) => r.isOwn)!;
    expect(own.name).toBe('Миша');
    const others = s.rows.filter((r) => !r.isOwn && !r.isFake);
    for (const o of others) {
      expect(o.name).toMatch(/^[А-ЯЁ][а-яё]+ [А-ЯЁ]\.$/);
    }
    // стабильность: имя чужого детерминировано его userId
    expect(others.map((o) => o.name)).toContain(plausibleNameFor('a'));
  });

  it('приватность: реальные имена в LeagueEntry не передаются вообще (нет поля)', () => {
    // Интерфейс не принимает имена — обезличивание by construction
    const entry: LeagueEntry = { userId: 'x', weeklyXp: 1 };
    expect(Object.keys(entry)).toEqual(['userId', 'weeklyXp']);
  });

  it('иконка чужого — стабильный ключ из ник-генератора; свой — own', () => {
    const s = buildStandings([e(CHILD, 300), e('a', 500)], CHILD, 'Миша', 'w')!;
    const other = s.rows.find((r) => !r.isOwn && !r.isFake)!;
    // Ключ иконки — строка (не эмодзи), детерминирован userId
    expect(other.icon).toBe(nicknameFor('a').icon);
    expect(typeof other.icon).toBe('string');
    const own = s.rows.find((r) => r.isOwn)!;
    expect(own.icon).toBe('own');
  });

  it('сортировка по XP, ранги корректны', () => {
    const s = buildStandings([e(CHILD, 300), e('a', 500), e('b', 100)], CHILD, 'Миша', 'w')!;
    expect(s.rows[0].weeklyXp).toBe(500);
    expect(s.ownRank).toBe(2);
    expect(s.rows[0].rank).toBe(1);
  });

  it('свой НЕ последний: фейки не добавляются в середине', () => {
    const s = buildStandings([e(CHILD, 300), e('a', 500), e('b', 100)], CHILD, 'Миша', 'w')!;
    expect(s.rows.some((r) => r.isFake)).toBe(false);
  });

  it('свой последний → снизу появляются более слабые фейки в формате «Имя И.»', () => {
    const s = buildStandings([e(CHILD, 100), e('a', 500), e('b', 300)], CHILD, 'Миша', 'w')!;
    const fakes = s.rows.filter((r) => r.isFake);
    expect(fakes.length).toBeGreaterThan(0);
    const own = s.rows.find((r) => r.isOwn)!;
    for (const f of fakes) {
      expect(f.weeklyXp).toBeLessThanOrEqual(own.weeklyXp);
      expect(f.rank).toBeGreaterThan(own.rank);
      // Правдоподобное имя: «Имя И.» (генерация, не ник «Прилагательное Существительное 42»)
      expect(f.name).toMatch(/^[А-ЯЁ][а-яё]+ [А-ЯЁ]\.$/);
    }
  });

  it('при нулевом XP своего фейки всё равно ниже него', () => {
    const s = buildStandings([e(CHILD, 0), e('a', 500)], CHILD, 'Миша', 'w')!;
    const own = s.rows.find((r) => r.isOwn)!;
    for (const f of s.rows.filter((r) => r.isFake)) {
      expect(f.rank).toBeGreaterThan(own.rank);
    }
  });

  it('фейки стабильны внутри недели и меняются между неделями', () => {
    const mk = (seed: string) =>
      buildStandings([e(CHILD, 50), e('a', 500)], CHILD, 'Миша', seed)!
        .rows.filter((r) => r.isFake).map((r) => r.name);
    expect(mk('2026-W32')).toEqual(mk('2026-W32'));
    expect(mk('2026-W32')).not.toEqual(mk('2026-W33'));
  });

  it('перцентиль: лидер 100, последний 0, единственный 100', () => {
    const top = buildStandings([e(CHILD, 900), e('a', 500), e('b', 100)], CHILD, 'М', 'w')!;
    expect(top.percentile).toBe(100);
    const last = buildStandings([e(CHILD, 10), e('a', 500), e('b', 100)], CHILD, 'М', 'w')!;
    expect(last.percentile).toBe(0);
    const solo = buildStandings([e(CHILD, 10)], CHILD, 'М', 'w')!;
    expect(solo.percentile).toBe(100);
  });

  it('свой глубоко внизу большой когорты — всё равно виден в окне', () => {
    const entries = [e(CHILD, 1)];
    for (let i = 0; i < 30; i++) entries.push(e(`u${i}`, 1000 - i * 10));
    const s = buildStandings(entries, CHILD, 'Миша', 'w')!;
    expect(s.rows.some((r) => r.isOwn)).toBe(true);
    expect(s.totalReal).toBe(31);
  });
});

describe('isoWeekLabel', () => {
  it('формат и корректная неделя', () => {
    expect(isoWeekLabel(new Date('2026-08-07T12:00:00Z'))).toMatch(/^2026-W\d{2}$/);
    // 1 января 2026 — четверг → неделя 1
    expect(isoWeekLabel(new Date('2026-01-01T12:00:00Z'))).toBe('2026-W01');
  });
});
