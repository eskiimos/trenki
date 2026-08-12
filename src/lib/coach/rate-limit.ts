/**
 * Простой in-memory rate limiter для критичных эндпоинтов.
 * Не подходит для горизонтального масштабирования (несколько инстансов будут считать отдельно),
 * но даёт базовую защиту от перебора в рамках одного процесса.
 */
type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  resetIn: number; // ms
}

/**
 * @param key   уникальный ключ (например, userId или IP)
 * @param limit максимальное число запросов в окне
 * @param windowMs длина окна в миллисекундах
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, resetIn: windowMs };
  }
  if (b.count >= limit) {
    return { ok: false, remaining: 0, resetIn: b.resetAt - now };
  }
  b.count++;
  return { ok: true, remaining: limit - b.count, resetIn: b.resetAt - now };
}

/**
 * Сброс окна для конкретного ключа (напр. чтобы тестер мог сразу продолжить
 * после накрутки, не дожидаясь окончания суточного окна gen-v3). In-memory —
 * влияет только на текущий процесс.
 */
export function resetRateLimit(key: string): void {
  buckets.delete(key);
}
