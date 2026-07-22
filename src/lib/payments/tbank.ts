import crypto from 'crypto';

// Клиент интернет-эквайринга T-Bank (eacq). Секреты — ТОЛЬКО из env, не в репо:
//   TBANK_TERMINAL_KEY, TBANK_PASSWORD (+ опц. TBANK_API_BASE для тест-контура).
// Amount ВСЕГДА в копейках (int). Подпись Token — SHA-256 (НЕ HMAC), см. signToken.
// Реальный статус платежа — из Notification (вебхук) + GetState, не из редиректа.

const DEFAULT_API_BASE = 'https://securepay.tinkoff.ru/v2';

export interface TbankConfig {
  terminalKey: string;
  password: string;
  apiBase: string;
}

/** Конфиг из env. null, если ключи не заданы (тогда оплата недоступна — деградируем мягко). */
export function getTbankConfig(): TbankConfig | null {
  const terminalKey = process.env.TBANK_TERMINAL_KEY;
  const password = process.env.TBANK_PASSWORD;
  if (!terminalKey || !password) return null;
  return {
    terminalKey,
    password,
    apiBase: (process.env.TBANK_API_BASE || DEFAULT_API_BASE).replace(/\/+$/, ''),
  };
}

/** Базовый origin для Notification/Success/Fail URL. Из env TBANK_RETURN_ORIGIN. */
export function getReturnOrigin(): string {
  return (process.env.TBANK_RETURN_ORIGIN || 'https://trenki.app').replace(/\/+$/, '');
}

// Параметры, не участвующие в подписи Token.
const EXCLUDED_FROM_TOKEN = new Set(['Token', 'Receipt', 'DATA']);

/**
 * Подпись Token для T-Bank (НЕ HMAC!):
 * берём корневые СКАЛЯРНЫЕ параметры (кроме Token/Receipt/DATA), добавляем Password,
 * сортируем по ключу, конкатенируем значения, считаем SHA-256 (hex).
 * Та же схема — для проверки входящих Notification.
 */
export function signToken(params: Record<string, unknown>, password: string): string {
  const entries: Array<[string, string]> = [];
  for (const [key, value] of Object.entries(params)) {
    if (EXCLUDED_FROM_TOKEN.has(key)) continue;
    if (value === undefined || value === null) continue;
    if (typeof value === 'object') continue; // вложенные объекты/массивы (Receipt/DATA) не участвуют
    entries.push([key, String(value)]);
  }
  entries.push(['Password', password]);
  entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const concatenated = entries.map(([, v]) => v).join('');
  return crypto.createHash('sha256').update(concatenated, 'utf8').digest('hex');
}

/** Достраивает тело запроса: TerminalKey + Token. */
export function withToken(config: TbankConfig, body: Record<string, unknown>): Record<string, unknown> {
  const full = { TerminalKey: config.terminalKey, ...body };
  const Token = signToken(full, config.password);
  return { ...full, Token };
}

/**
 * Проверка подписи входящего Notification (вебхук). Считаем Token по тем же правилам
 * от присланных полей и сравниваем с payload.Token (constant-time).
 */
export function verifyNotificationToken(config: TbankConfig, payload: Record<string, unknown>): boolean {
  const received = payload.Token;
  if (typeof received !== 'string' || received.length === 0) return false;
  const expected = signToken(payload, config.password);
  try {
    return crypto.timingSafeEqual(Buffer.from(received, 'utf8'), Buffer.from(expected, 'utf8'));
  } catch {
    return received === expected;
  }
}

// ─── Вызовы API ──────────────────────────────────────────────────────────────

async function callApi<T = Record<string, unknown>>(
  config: TbankConfig,
  method: string,
  body: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(`${config.apiBase}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(withToken(config, body)),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) {
    throw new Error(`T-Bank ${method} HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

export interface InitParams {
  amountKopecks: number; // в КОПЕЙКАХ (int)
  orderId: string; // уникальный, не переиспользовать
  description?: string;
  customerKey?: string; // для рекуррента/привязки карты
  recurrent?: boolean; // true → Recurrent=Y (первый платёж подписки)
  notificationURL?: string;
  successURL?: string;
  failURL?: string;
  receipt?: Record<string, unknown>; // 54-ФЗ, не участвует в подписи Token
  data?: Record<string, unknown>; // DATA, не участвует в подписи Token
}

export interface InitResult {
  Success: boolean;
  ErrorCode: string;
  PaymentId?: string;
  PaymentURL?: string;
  Status?: string;
  Message?: string;
  Details?: string;
}

/** Инициализация платежа → PaymentId + PaymentURL (на него редиректим клиента). */
export async function initPayment(config: TbankConfig, p: InitParams): Promise<InitResult> {
  const body: Record<string, unknown> = {
    Amount: Math.round(p.amountKopecks),
    OrderId: p.orderId,
  };
  if (p.description) body.Description = p.description;
  if (p.customerKey) body.CustomerKey = p.customerKey;
  if (p.recurrent) body.Recurrent = 'Y';
  if (p.notificationURL) body.NotificationURL = p.notificationURL;
  if (p.successURL) body.SuccessURL = p.successURL;
  if (p.failURL) body.FailURL = p.failURL;
  if (p.receipt) body.Receipt = p.receipt;
  if (p.data) body.DATA = p.data;
  return callApi<InitResult>(config, 'Init', body);
}

export interface GetStateResult {
  Success: boolean;
  ErrorCode: string;
  Status?: string; // NEW/FORM_SHOWED/AUTHORIZED/CONFIRMED/REJECTED/REFUNDED/...
  PaymentId?: string;
  OrderId?: string;
  Amount?: number;
  Message?: string;
}

/** Актуальный статус платежа (источник истины наравне с Notification). */
export async function getState(config: TbankConfig, paymentId: string): Promise<GetStateResult> {
  return callApi<GetStateResult>(config, 'GetState', { PaymentId: paymentId });
}

export interface ChargeResult {
  Success: boolean;
  ErrorCode: string;
  Status?: string;
  PaymentId?: string;
  OrderId?: string;
  Amount?: number;
  Message?: string;
  Details?: string;
}

/**
 * Автосписание по сохранённой карте (рекуррент): Init нового платежа (без
 * редиректа клиента) → Charge с PaymentId + RebillId. Списывает сразу.
 */
export async function chargeByRebill(
  config: TbankConfig,
  p: { orderId: string; amountKopecks: number; rebillId: string; description?: string; notificationURL?: string },
): Promise<{ init: InitResult; charge?: ChargeResult }> {
  const init = await initPayment(config, {
    amountKopecks: p.amountKopecks,
    orderId: p.orderId,
    description: p.description,
    notificationURL: p.notificationURL, // чтобы вебхук пришёл и по автосписанию тоже
  });
  if (!init.Success || !init.PaymentId) return { init };
  const charge = await callApi<ChargeResult>(config, 'Charge', {
    PaymentId: init.PaymentId,
    RebillId: p.rebillId,
  });
  return { init, charge };
}
