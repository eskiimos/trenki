import { describe, it, expect } from 'vitest';
import { isPaywalled, normalizePaywallMode, PAYWALL_MODE_DEFAULT } from '../../src/lib/paywall';

const NOW = new Date('2026-07-06T12:00:00Z');
const future = new Date('2026-08-01T00:00:00Z');
const past = new Date('2026-01-01T00:00:00Z');

const freeUser = { accessTier: 'FREE', premiumUntil: null, isAdmin: false };
const freeAdmin = { accessTier: 'FREE', premiumUntil: null, isAdmin: true };
const premiumUser = { accessTier: 'PREMIUM', premiumUntil: future, isAdmin: false };
const premiumAdmin = { accessTier: 'PREMIUM', premiumUntil: null, isAdmin: true };
const expiredUser = { accessTier: 'PREMIUM', premiumUntil: past, isAdmin: false };

describe('normalizePaywallMode', () => {
  it('пропускает валидные режимы', () => {
    expect(normalizePaywallMode('off')).toBe('off');
    expect(normalizePaywallMode('admins')).toBe('admins');
    expect(normalizePaywallMode('on')).toBe('on');
  });
  it('битое/пустое → дефолт off', () => {
    expect(normalizePaywallMode(undefined)).toBe(PAYWALL_MODE_DEFAULT);
    expect(normalizePaywallMode(null)).toBe('off');
    expect(normalizePaywallMode('ON')).toBe('off');
    expect(normalizePaywallMode('garbage')).toBe('off');
  });
});

describe('isPaywalled', () => {
  it('режим off — paywall выключен для всех', () => {
    expect(isPaywalled(freeUser, 'off', NOW)).toBe(false);
    expect(isPaywalled(freeAdmin, 'off', NOW)).toBe(false);
    expect(isPaywalled(premiumUser, 'off', NOW)).toBe(false);
  });

  it('режим on — активен для всех без премиума', () => {
    expect(isPaywalled(freeUser, 'on', NOW)).toBe(true);
    expect(isPaywalled(freeAdmin, 'on', NOW)).toBe(true);
  });

  it('режим on — премиум обходит paywall', () => {
    expect(isPaywalled(premiumUser, 'on', NOW)).toBe(false);
    expect(isPaywalled(premiumAdmin, 'on', NOW)).toBe(false);
  });

  it('режим admins — активен только для админов без премиума', () => {
    expect(isPaywalled(freeAdmin, 'admins', NOW)).toBe(true);
    expect(isPaywalled(freeUser, 'admins', NOW)).toBe(false); // живой юзер не видит
    expect(isPaywalled(premiumAdmin, 'admins', NOW)).toBe(false); // премиум-админ обходит
  });

  it('истёкший премиум считается как FREE', () => {
    expect(isPaywalled(expiredUser, 'on', NOW)).toBe(true);
    expect(isPaywalled(expiredUser, 'admins', NOW)).toBe(false); // не админ
  });

  it('null/undefined юзер — не гейтим', () => {
    expect(isPaywalled(null, 'on', NOW)).toBe(false);
    expect(isPaywalled(undefined, 'admins', NOW)).toBe(false);
  });
});
