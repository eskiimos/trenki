import { describe, it, expect } from 'vitest';
import { localDateStr, localMinuteOfDay } from '../../src/lib/notifications/local-time';

describe('local-time', () => {
  const now = new Date('2026-09-22T15:05:00Z');

  it('дата и минута по таймзоне игрока', () => {
    expect(localDateStr(now, 'Europe/Moscow')).toBe('2026-09-22');
    expect(localMinuteOfDay(now, 'Europe/Moscow')).toBe(18 * 60 + 5);
    expect(localDateStr(now, 'Asia/Vladivostok')).toBe('2026-09-23');
    expect(localMinuteOfDay(now, 'Asia/Vladivostok')).toBe(1 * 60 + 5);
  });

  it('битая или пустая таймзона — МСК', () => {
    expect(localMinuteOfDay(now, 'Mars/Olympus')).toBe(18 * 60 + 5);
    expect(localDateStr(now, null)).toBe('2026-09-22');
  });

  it('полночь — 0, а не 1440', () => {
    expect(localMinuteOfDay(new Date('2026-09-22T21:00:00Z'), 'Europe/Moscow')).toBe(0);
  });
});
