import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  getTbankConfigFor,
  getTbankConfigByTerminalKey,
  tbankModesStatus,
  normalizePaymentsMode,
} from '../../src/lib/payments/tbank';

const KEYS = [
  'TBANK_TERMINAL_KEY', 'TBANK_PASSWORD', 'TBANK_API_BASE',
  'TBANK_TEST_TERMINAL_KEY', 'TBANK_TEST_PASSWORD', 'TBANK_TEST_API_BASE',
] as const;

let saved: Record<string, string | undefined>;

beforeEach(() => {
  saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
  for (const k of KEYS) delete process.env[k];
});
afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k]!;
  }
});

describe('normalizePaymentsMode', () => {
  it('только «test» включает тестовую кассу; всё остальное — боевая', () => {
    expect(normalizePaymentsMode('test')).toBe('test');
    expect(normalizePaymentsMode('live')).toBe('live');
    // Пустая/битая настройка НЕ должна случайно перевести приём денег в тест
    expect(normalizePaymentsMode(null)).toBe('live');
    expect(normalizePaymentsMode(undefined)).toBe('live');
    expect(normalizePaymentsMode('TEST')).toBe('live');
  });
});

describe('getTbankConfigFor', () => {
  it('берёт свой набор env под каждый режим', () => {
    process.env.TBANK_TERMINAL_KEY = 'live123';
    process.env.TBANK_PASSWORD = 'livepass';
    process.env.TBANK_TEST_TERMINAL_KEY = 'live123DEMO';
    process.env.TBANK_TEST_PASSWORD = 'testpass';
    expect(getTbankConfigFor('live')).toMatchObject({ terminalKey: 'live123', password: 'livepass' });
    expect(getTbankConfigFor('test')).toMatchObject({ terminalKey: 'live123DEMO', password: 'testpass' });
  });

  it('без ключей режима — null (оплата деградирует мягко)', () => {
    process.env.TBANK_TERMINAL_KEY = 'live123';
    process.env.TBANK_PASSWORD = 'livepass';
    expect(getTbankConfigFor('test')).toBeNull();
    delete process.env.TBANK_PASSWORD;
    expect(getTbankConfigFor('live')).toBeNull();
  });

  it('apiBase: свой на режим, дефолт боевой, хвостовые слэши срезаются', () => {
    process.env.TBANK_TERMINAL_KEY = 'k';
    process.env.TBANK_PASSWORD = 'p';
    process.env.TBANK_TEST_TERMINAL_KEY = 'kt';
    process.env.TBANK_TEST_PASSWORD = 'pt';
    process.env.TBANK_TEST_API_BASE = 'https://rest-api-test.tinkoff.ru/v2///';
    expect(getTbankConfigFor('live')!.apiBase).toBe('https://securepay.tinkoff.ru/v2');
    expect(getTbankConfigFor('test')!.apiBase).toBe('https://rest-api-test.tinkoff.ru/v2');
  });
});

describe('getTbankConfigByTerminalKey — вебхук после переключения кассы', () => {
  beforeEach(() => {
    process.env.TBANK_TERMINAL_KEY = 'live123';
    process.env.TBANK_PASSWORD = 'livepass';
    process.env.TBANK_TEST_TERMINAL_KEY = 'test999';
    process.env.TBANK_TEST_PASSWORD = 'testpass';
  });

  it('нотификация каждой кассы проверяется её же паролем', () => {
    expect(getTbankConfigByTerminalKey('live123')!.password).toBe('livepass');
    expect(getTbankConfigByTerminalKey('test999')!.password).toBe('testpass');
  });

  it('чужой или пустой TerminalKey → null', () => {
    expect(getTbankConfigByTerminalKey('someoneelse')).toBeNull();
    expect(getTbankConfigByTerminalKey('')).toBeNull();
    expect(getTbankConfigByTerminalKey(null)).toBeNull();
  });
});

describe('tbankModesStatus', () => {
  it('показывает, какие кассы настроены, и не отдаёт пароли', () => {
    process.env.TBANK_TERMINAL_KEY = 'live123';
    process.env.TBANK_PASSWORD = 'livepass';
    const st = tbankModesStatus();
    expect(st.live).toEqual({ configured: true, terminalKey: 'live123' });
    expect(st.test).toEqual({ configured: false, terminalKey: null });
    expect(JSON.stringify(st)).not.toContain('livepass');
  });
});
