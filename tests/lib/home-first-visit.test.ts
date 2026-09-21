import { describe, it, expect } from 'vitest';
import {
  NEWCOMER_WINDOW_MS,
  TOUR_COMPLETED_KEY,
  GUIDE_DISMISSED_KEY,
  TOUR_STARTED_KEY,
  isFreshAccount,
  isNewcomer,
  readGuideFlags,
  canShowHomeExtras,
  type GuideFlags,
} from '@/lib/home-first-visit';

const NOW = new Date('2026-09-21T12:00:00Z');
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 60 * 60 * 1000);

const NO_FLAGS: GuideFlags = { tourCompleted: false, guideDismissed: false, tourStarted: false };

const storageOf = (items: Record<string, string>) => ({
  getItem: (k: string) => (k in items ? items[k] : null),
});

describe('home-first-visit — isFreshAccount', () => {
  it('аккаунт моложе суток — свежий', () => {
    expect(isFreshAccount(hoursAgo(0), NOW)).toBe(true);
    expect(isFreshAccount(hoursAgo(23.9), NOW)).toBe(true);
  });

  it('ровно сутки и старше — не свежий', () => {
    expect(isFreshAccount(new Date(NOW.getTime() - NEWCOMER_WINDOW_MS), NOW)).toBe(false);
    expect(isFreshAccount(hoursAgo(72), NOW)).toBe(false);
  });

  it('дата из будущего (рассинхрон часов) — свежий', () => {
    expect(isFreshAccount(hoursAgo(-1), NOW)).toBe(true);
  });
});

describe('home-first-visit — isNewcomer', () => {
  const fresh = { createdAt: hoursAgo(1), hasAnyCheckin: false, hasAnyWorkout: false };

  it('свежий аккаунт без чек-инов и тренировок — новичок', () => {
    expect(isNewcomer(fresh, NOW)).toBe(true);
  });

  it('аккаунту больше суток — не новичок', () => {
    expect(isNewcomer({ ...fresh, createdAt: hoursAgo(25) }, NOW)).toBe(false);
  });

  it('уже был чек-ин — не новичок (защита действующих пользователей)', () => {
    expect(isNewcomer({ ...fresh, hasAnyCheckin: true }, NOW)).toBe(false);
  });

  it('есть завершённая тренировка — не новичок', () => {
    expect(isNewcomer({ ...fresh, hasAnyWorkout: true }, NOW)).toBe(false);
  });
});

describe('home-first-visit — readGuideFlags', () => {
  it('пустое хранилище — флагов нет', () => {
    expect(readGuideFlags(storageOf({}))).toEqual(NO_FLAGS);
  });

  it('читает все три флага', () => {
    expect(
      readGuideFlags(storageOf({ [TOUR_COMPLETED_KEY]: '1', [GUIDE_DISMISSED_KEY]: '1', [TOUR_STARTED_KEY]: '1' })),
    ).toEqual({ tourCompleted: true, guideDismissed: true, tourStarted: true });
  });

  it('исторические ключи совпадают с TourProvider и плашкой гида', () => {
    expect(TOUR_COMPLETED_KEY).toBe('trenki_tour_completed');
    expect(GUIDE_DISMISSED_KEY).toBe('trenki_guide_banner_dismissed');
  });

  it('нет хранилища или оно бросает — флагов нет, без исключения', () => {
    expect(readGuideFlags(null)).toEqual(NO_FLAGS);
    expect(readGuideFlags(undefined)).toEqual(NO_FLAGS);
    const throwing = {
      getItem: () => {
        throw new Error('SecurityError');
      },
    };
    expect(readGuideFlags(throwing)).toEqual(NO_FLAGS);
  });
});

describe('home-first-visit — canShowHomeExtras', () => {
  it('первый заход новичка: гид не тронут → прячем', () => {
    expect(canShowHomeExtras({ tourActive: false, flags: NO_FLAGS, newcomer: true })).toBe(false);
  });

  it('пока ничего не известно → прячем (без мигания)', () => {
    expect(canShowHomeExtras({ tourActive: false, flags: null, newcomer: null })).toBe(false);
    expect(canShowHomeExtras({ tourActive: false, flags: NO_FLAGS, newcomer: null })).toBe(false);
  });

  it('тур пройден / плашка закрыта / тур запускали → показываем даже новичку', () => {
    expect(
      canShowHomeExtras({ tourActive: false, flags: { ...NO_FLAGS, tourCompleted: true }, newcomer: true }),
    ).toBe(true);
    expect(
      canShowHomeExtras({ tourActive: false, flags: { ...NO_FLAGS, guideDismissed: true }, newcomer: true }),
    ).toBe(true);
    expect(
      canShowHomeExtras({ tourActive: false, flags: { ...NO_FLAGS, tourStarted: true }, newcomer: null }),
    ).toBe(true);
  });

  it('не новичок (сутки/чек-ин/тренировка) без флагов гида → показываем', () => {
    expect(canShowHomeExtras({ tourActive: false, flags: NO_FLAGS, newcomer: false })).toBe(true);
    expect(canShowHomeExtras({ tourActive: false, flags: null, newcomer: false })).toBe(true);
  });

  it('тур идёт прямо сейчас → прячем при любых флагах', () => {
    const all: GuideFlags = { tourCompleted: true, guideDismissed: true, tourStarted: true };
    expect(canShowHomeExtras({ tourActive: true, flags: all, newcomer: false })).toBe(false);
  });
});
