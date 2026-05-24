import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { logger } from '@/lib/logger';

interface Captured {
  level: 'log' | 'warn' | 'error';
  payload: any;
}

let captured: Captured[];
let originalLog: typeof console.log;
let originalWarn: typeof console.warn;
let originalError: typeof console.error;

beforeEach(() => {
  captured = [];
  originalLog = console.log;
  originalWarn = console.warn;
  originalError = console.error;
  console.log = (s: string) => captured.push({ level: 'log', payload: JSON.parse(s) });
  console.warn = (s: string) => captured.push({ level: 'warn', payload: JSON.parse(s) });
  console.error = (s: string) => captured.push({ level: 'error', payload: JSON.parse(s) });
  process.env.LOG_LEVEL = 'debug';
});

afterEach(() => {
  console.log = originalLog;
  console.warn = originalWarn;
  console.error = originalError;
  vi.unstubAllEnvs();
});

describe('logger PII redaction', () => {
  it('password/token/code заменяются на [REDACTED]', () => {
    logger.info('login', { password: 'secret', token: 'jwt', code: '123456' });
    const meta = captured[0].payload.meta;
    expect(meta.password).toBe('[REDACTED]');
    expect(meta.token).toBe('[REDACTED]');
    expect(meta.code).toBe('[REDACTED]');
  });

  it('email и telegramId превращаются в стабильный короткий хэш', () => {
    logger.info('event', { email: 'user@example.com', telegramId: '12345' });
    const meta = captured[0].payload.meta;
    expect(meta.email).toMatch(/^#[a-z0-9]+$/);
    expect(meta.telegramId).toMatch(/^#[a-z0-9]+$/);
    // Один и тот же вход → один и тот же хэш (стабильность для grep по логам).
    logger.info('event2', { email: 'user@example.com' });
    expect(captured[1].payload.meta.email).toBe(meta.email);
  });

  it('обычные поля проходят без изменений', () => {
    logger.info('event', { userId: 'abc', count: 5 });
    expect(captured[0].payload.meta).toEqual({ userId: 'abc', count: 5 });
  });

  it('вложенные объекты тоже редактируются', () => {
    logger.info('nested', { user: { email: 'a@b.c', password: 'p' } });
    const u = captured[0].payload.meta.user;
    expect(u.password).toBe('[REDACTED]');
    expect(u.email).toMatch(/^#/);
  });
});

describe('logger levels', () => {
  it('error пишется в console.error', () => {
    logger.error('boom', new Error('kaboom'));
    expect(captured[0].level).toBe('error');
    expect(captured[0].payload.meta.errName).toBe('Error');
    expect(captured[0].payload.meta.errMessage).toBe('kaboom');
  });

  it('LOG_LEVEL=warn заглушает info и debug', () => {
    process.env.LOG_LEVEL = 'warn';
    logger.info('quiet');
    logger.debug('quiet');
    logger.warn('loud');
    expect(captured.map(c => c.level)).toEqual(['warn']);
  });
});
