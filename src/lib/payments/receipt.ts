// Чек по 54-ФЗ для платежей T-Bank (облачная касса «Чеки от Т-Бизнеса»).
// Объект Receipt передаётся в Init и НЕ участвует в подписи Token (см. tbank.ts).
//
// Чистая логика: сборка и валидация чека тестируются без сети и БД. Значения
// СНО и ставки НДС берутся из настроек админки — угадывать их нельзя, неверный
// реквизит в чеке = нарушение 54-ФЗ.

/** Системы налогообложения (поле Taxation). */
export const TAXATION_VALUES = [
  'osn', // общая
  'usn_income', // УСН доходы
  'usn_income_outcome', // УСН доходы минус расходы
  'envd', // ЕНВД
  'esn', // ЕСХН
  'patent', // патент
] as const;
export type Taxation = (typeof TAXATION_VALUES)[number];

/** Ставки НДС (поле Tax у позиции чека). */
export const VAT_VALUES = ['none', 'vat0', 'vat10', 'vat20', 'vat110', 'vat120'] as const;
export type Vat = (typeof VAT_VALUES)[number];

export const TAXATION_DEFAULT: Taxation = 'usn_income';
export const VAT_DEFAULT: Vat = 'none'; // на УСН НДС не начисляется

/** Наименование позиции ограничено 128 символами (требование ФФД). */
const MAX_NAME_LEN = 128;

export interface ReceiptItem {
  Name: string;
  Price: number; // копейки за единицу
  Quantity: number;
  Amount: number; // копейки за позицию (Price * Quantity)
  Tax: Vat;
  PaymentMethod: 'full_payment';
  PaymentObject: 'service';
}

export interface Receipt {
  Email?: string;
  Phone?: string;
  Taxation: Taxation;
  Items: ReceiptItem[];
}

export function normalizeTaxation(v: string | null | undefined): Taxation {
  return TAXATION_VALUES.includes(v as Taxation) ? (v as Taxation) : TAXATION_DEFAULT;
}

export function normalizeVat(v: string | null | undefined): Vat {
  return VAT_VALUES.includes(v as Vat) ? (v as Vat) : VAT_DEFAULT;
}

export interface BuildReceiptParams {
  amountKopecks: number;
  /** Email покупателя — на него касса отправит чек. */
  email?: string | null;
  /** Телефон, если email нет. Нужен хотя бы один контакт. */
  phone?: string | null;
  name: string;
  taxation: Taxation;
  vat: Vat;
}

/**
 * Собирает чек на одну позицию (доступ к сервису — это услуга, полный расчёт).
 * Возвращает null, если чек собрать нельзя (нет контакта покупателя или сумма
 * некорректна) — вызывающий решает, блокировать платёж или платить без чека.
 * Инвариант: сумма позиций строго равна сумме платежа, иначе касса отклонит чек.
 */
export function buildReceipt(p: BuildReceiptParams): Receipt | null {
  const amount = Math.round(p.amountKopecks);
  if (!Number.isInteger(amount) || amount <= 0) return null;

  const email = p.email?.trim() || undefined;
  const phone = p.phone?.trim() || undefined;
  // 54-ФЗ: чек надо куда-то отправить. Без контакта чек невалиден.
  if (!email && !phone) return null;

  const name = p.name.trim().slice(0, MAX_NAME_LEN) || 'Услуга';

  return {
    ...(email ? { Email: email } : {}),
    ...(phone ? { Phone: phone } : {}),
    Taxation: p.taxation,
    Items: [
      {
        Name: name,
        Price: amount,
        Quantity: 1,
        Amount: amount, // = Price * Quantity, и равно сумме платежа
        Tax: p.vat,
        PaymentMethod: 'full_payment', // полная оплата в момент расчёта
        PaymentObject: 'service', // доступ к сервису — услуга
      },
    ],
  };
}

/** Сумма позиций чека. Должна совпадать с Amount платежа. */
export function receiptTotal(r: Receipt): number {
  return r.Items.reduce((s, i) => s + i.Amount, 0);
}
