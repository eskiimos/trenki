import { describe, it, expect } from 'vitest';
import {
  buildReceipt,
  receiptTotal,
  normalizeTaxation,
  normalizeVat,
  TAXATION_DEFAULT,
  VAT_DEFAULT,
} from '../../src/lib/payments/receipt';

const base = {
  amountKopecks: 120000,
  email: 'user@example.com',
  name: 'Доступ к сервису «Треньки», 30 дней',
  taxation: 'usn_income' as const,
  vat: 'none' as const,
};

describe('нормализация реквизитов', () => {
  it('пропускает валидные значения', () => {
    expect(normalizeTaxation('osn')).toBe('osn');
    expect(normalizeVat('vat20')).toBe('vat20');
  });
  it('битое/пустое → безопасный дефолт', () => {
    expect(normalizeTaxation('ерунда')).toBe(TAXATION_DEFAULT);
    expect(normalizeTaxation(null)).toBe(TAXATION_DEFAULT);
    expect(normalizeVat(undefined)).toBe(VAT_DEFAULT);
  });
});

describe('buildReceipt', () => {
  it('собирает чек на одну позицию-услугу', () => {
    const r = buildReceipt(base)!;
    expect(r.Taxation).toBe('usn_income');
    expect(r.Email).toBe('user@example.com');
    expect(r.Items).toHaveLength(1);
    expect(r.Items[0]!.PaymentObject).toBe('service');
    expect(r.Items[0]!.PaymentMethod).toBe('full_payment');
    expect(r.Items[0]!.Tax).toBe('none');
  });

  it('КРИТИЧНО: сумма позиций строго равна сумме платежа', () => {
    for (const amount of [500, 10000, 120000, 30000]) {
      const r = buildReceipt({ ...base, amountKopecks: amount })!;
      expect(receiptTotal(r)).toBe(amount);
      expect(r.Items[0]!.Price * r.Items[0]!.Quantity).toBe(amount);
    }
  });

  it('без контакта покупателя чек не собирается (его некуда отправить)', () => {
    expect(buildReceipt({ ...base, email: null })).toBeNull();
    expect(buildReceipt({ ...base, email: '   ' })).toBeNull();
  });

  it('телефона достаточно, если нет email', () => {
    const r = buildReceipt({ ...base, email: null, phone: '+79990000000' })!;
    expect(r.Phone).toBe('+79990000000');
    expect(r.Email).toBeUndefined();
  });

  it('нулевая/отрицательная сумма отклоняется', () => {
    expect(buildReceipt({ ...base, amountKopecks: 0 })).toBeNull();
    expect(buildReceipt({ ...base, amountKopecks: -100 })).toBeNull();
  });

  it('наименование обрезается до 128 символов (лимит ФФД)', () => {
    const r = buildReceipt({ ...base, name: 'я'.repeat(300) })!;
    expect(r.Items[0]!.Name.length).toBe(128);
  });

  it('ставка НДС берётся из настроек (ОСН → vat20)', () => {
    const r = buildReceipt({ ...base, taxation: 'osn', vat: 'vat20' })!;
    expect(r.Taxation).toBe('osn');
    expect(r.Items[0]!.Tax).toBe('vat20');
  });
});
