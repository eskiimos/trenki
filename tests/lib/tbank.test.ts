import { describe, it, expect } from 'vitest';
import { signToken, verifyNotificationToken, withToken } from '../../src/lib/payments/tbank';

const CONFIG = { terminalKey: 'MerchantTerminalKey', password: 'usaf8fw8fsw21g', apiBase: 'x' };

describe('signToken', () => {
  // Канонический пример из документации T-Bank (проверяет, что алгоритм совпадает
  // с эталоном: сорт по ключу + Password + SHA-256). Если падает — либо алгоритм,
  // либо эталонный хэш; смотреть actual vs expected.
  it('совпадает с эталонным вектором T-Bank', () => {
    const params = {
      TerminalKey: 'MerchantTerminalKey',
      Amount: 19200,
      OrderId: '21090',
      Description: 'Подарочная карта на 1000 рублей',
    };
    expect(signToken(params, 'usaf8fw8fsw21g')).toBe(
      '0024a00af7c350a3a67ca168ce06502aa72772456662e38696d48b56ee9c97d9',
    );
  });

  it('не зависит от порядка ключей', () => {
    const a = signToken({ TerminalKey: 'T', Amount: 100, OrderId: '1' }, 'p');
    const b = signToken({ OrderId: '1', TerminalKey: 'T', Amount: 100 }, 'p');
    expect(a).toBe(b);
  });

  it('исключает Token/Receipt/DATA и вложенные объекты', () => {
    const base = { TerminalKey: 'T', Amount: 100, OrderId: '1' };
    const withExtra = {
      ...base,
      Token: 'old',
      Receipt: { items: [1, 2] },
      DATA: { foo: 'bar' },
    };
    expect(signToken(withExtra, 'p')).toBe(signToken(base, 'p'));
  });

  it('null/undefined значения не участвуют', () => {
    const a = signToken({ TerminalKey: 'T', Amount: 100, Extra: null, More: undefined }, 'p');
    const b = signToken({ TerminalKey: 'T', Amount: 100 }, 'p');
    expect(a).toBe(b);
  });
});

describe('withToken', () => {
  it('добавляет TerminalKey и валидный Token', () => {
    const body = withToken(CONFIG, { Amount: 19200, OrderId: '21090', Description: 'Подарочная карта на 1000 рублей' });
    expect(body.TerminalKey).toBe('MerchantTerminalKey');
    expect(body.Token).toBe('0024a00af7c350a3a67ca168ce06502aa72772456662e38696d48b56ee9c97d9');
  });
});

describe('verifyNotificationToken', () => {
  it('принимает корректно подписанный payload', () => {
    const payload: Record<string, unknown> = {
      TerminalKey: 'MerchantTerminalKey',
      OrderId: '21090',
      Success: true,
      Status: 'CONFIRMED',
      PaymentId: '700000',
      Amount: 19200,
    };
    payload.Token = signToken(payload, CONFIG.password);
    expect(verifyNotificationToken(CONFIG, payload)).toBe(true);
  });

  it('отклоняет подделанный payload', () => {
    const payload: Record<string, unknown> = {
      TerminalKey: 'MerchantTerminalKey',
      OrderId: '21090',
      Success: true,
      Status: 'CONFIRMED',
      Amount: 19200,
    };
    payload.Token = signToken(payload, CONFIG.password);
    payload.Amount = 1; // подмена суммы после подписи
    expect(verifyNotificationToken(CONFIG, payload)).toBe(false);
  });

  it('отклоняет payload без Token', () => {
    expect(verifyNotificationToken(CONFIG, { OrderId: '1' })).toBe(false);
  });
});
