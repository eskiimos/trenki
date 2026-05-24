/**
 * Серверный логгер с уровнями и PII-редактором.
 *
 * Зачем:
 *  - console.log повсеместно мусорит логами reg.ru/Vercel и иногда печатает PII
 *    (email, telegramId, тело запроса).
 *  - Уровень контролируется LOG_LEVEL (debug|info|warn|error). По умолчанию в проде
 *    info, в dev — debug.
 *  - PII-поля редактируются автоматически (email, password, code, token, telegramId).
 */

type Level = 'debug' | 'info' | 'warn' | 'error';
const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

function currentLevel(): Level {
  const v = (process.env.LOG_LEVEL || '').toLowerCase() as Level;
  if (v && ORDER[v]) return v;
  return process.env.NODE_ENV === 'production' ? 'info' : 'debug';
}

const REDACT_KEYS = new Set([
  'password',
  'pass',
  'token',
  'access_token',
  'refresh_token',
  'secret',
  'authorization',
  'cookie',
  'code',
  'otp',
  'sessionsecret',
  'session_secret',
  'apikey',
  'api_key',
]);

const HASH_KEYS = new Set([
  'email',
  'telegramid',
  'telegram_id',
  'phone',
  'ip',
]);

function shortHash(input: string): string {
  let h = 0;
  for (let i = 0; i < input.length; i += 1) {
    h = (h * 31 + input.charCodeAt(i)) | 0;
  }
  return `#${(h >>> 0).toString(36)}`;
}

function redactValue(key: string, value: unknown): unknown {
  const k = key.toLowerCase();
  if (REDACT_KEYS.has(k)) return '[REDACTED]';
  if (HASH_KEYS.has(k) && typeof value === 'string' && value.length > 0) {
    return `${shortHash(value)}`;
  }
  return value;
}

function redact(input: unknown, depth = 0): unknown {
  if (depth > 6) return '[depth limit]';
  if (input === null || input === undefined) return input;
  if (Array.isArray(input)) return input.map(v => redact(v, depth + 1));
  if (typeof input === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      out[k] = redact(redactValue(k, v), depth + 1);
    }
    return out;
  }
  return input;
}

function shouldLog(level: Level): boolean {
  return ORDER[level] >= ORDER[currentLevel()];
}

function emit(level: Level, msg: string, meta?: Record<string, unknown>): void {
  if (!shouldLog(level)) return;
  const line = {
    t: new Date().toISOString(),
    level,
    msg,
    ...(meta ? { meta: redact(meta) as Record<string, unknown> } : {}),
  };
  // Уровни маппятся на стандартные потоки, чтобы пишущая инфраструктура (PM2/Docker)
  // могла различать stderr/stdout.
  if (level === 'error') console.error(JSON.stringify(line));
  else if (level === 'warn') console.warn(JSON.stringify(line));
  else console.log(JSON.stringify(line));
}

export const logger = {
  debug: (msg: string, meta?: Record<string, unknown>) => emit('debug', msg, meta),
  info: (msg: string, meta?: Record<string, unknown>) => emit('info', msg, meta),
  warn: (msg: string, meta?: Record<string, unknown>) => emit('warn', msg, meta),
  error: (msg: string, err?: unknown, meta?: Record<string, unknown>) => {
    const errMeta =
      err instanceof Error
        ? { errName: err.name, errMessage: err.message }
        : err !== undefined
        ? { err: String(err) }
        : {};
    emit('error', msg, { ...errMeta, ...(meta ?? {}) });
  },
};

export type Logger = typeof logger;
