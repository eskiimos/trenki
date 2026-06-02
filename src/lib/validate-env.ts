/**
 * Валидация обязательных env-переменных в production.
 *
 * Вызывается один раз при старте сервера через instrumentation.ts.
 * Если в production не задана любая из REQUIRED — кидает Error и контейнер
 * падает сразу, а не висит «healthy» до первого 500 у пользователя.
 *
 * Это защита от инцидентов вроде «SESSION_SECRET пустой → POST verify-code
 * возвращает 500», который мы недавно ловили вживую.
 */

interface RequiredEnv {
  name: string;
  /** Минимальная длина значения (0 — не проверяем). */
  minLength?: number;
  /** Зачем нужна — попадает в текст ошибки. */
  reason: string;
}

const REQUIRED_IN_PROD: RequiredEnv[] = [
  { name: 'DATABASE_URL', reason: 'Prisma не подключится к БД' },
  { name: 'SESSION_SECRET', minLength: 32, reason: 'JWT-сессии: подпись токена упадёт, регистрация и логин вернут 500' },
  { name: 'CRON_SECRET', reason: 'Cron-задачи проверки тренировок не пройдут авторизацию' },
  { name: 'ADMIN_LOGIN', reason: 'Админ-вход вернёт 500' },
  { name: 'ADMIN_PASSWORD', reason: 'Админ-вход вернёт 500' },
  { name: 'RESEND_API_KEY', reason: 'Email-OTP не отправится — регистрация по email невозможна' },
  { name: 'NEXT_PUBLIC_VAPID_PUBLIC_KEY', reason: 'Подписка на push-уведомления упадёт на клиенте' },
  { name: 'VAPID_PRIVATE_KEY', reason: 'POST /api/push/send вернёт 500' },
  { name: 'CLOUDINARY_CLOUD_NAME', reason: 'Загрузка превью видео и pose-сессий упадёт' },
  { name: 'CLOUDINARY_API_KEY', reason: 'Загрузка превью видео и pose-сессий упадёт' },
  { name: 'CLOUDINARY_API_SECRET', reason: 'Загрузка превью видео и pose-сессий упадёт' },
];

export interface EnvCheckResult {
  ok: boolean;
  missing: Array<{ name: string; reason: string; problem: 'unset' | 'too_short' }>;
}

export function checkRequiredEnv(): EnvCheckResult {
  const missing: EnvCheckResult['missing'] = [];

  for (const { name, minLength, reason } of REQUIRED_IN_PROD) {
    const value = process.env[name];
    if (!value || value.length === 0) {
      missing.push({ name, reason, problem: 'unset' });
      continue;
    }
    if (minLength && value.length < minLength) {
      missing.push({ name, reason, problem: 'too_short' });
    }
  }

  return { ok: missing.length === 0, missing };
}

/**
 * Вызывается при старте сервера. В prod падаем fast, в dev — warning в stderr.
 */
export function validateProductionEnv(): void {
  const result = checkRequiredEnv();
  if (result.ok) return;

  const lines = result.missing.map(
    (m) =>
      `  - ${m.name} (${m.problem === 'too_short' ? 'короче минимума' : 'не задан'}): ${m.reason}`,
  );
  const msg = [
    `Отсутствуют обязательные env-переменные (${result.missing.length}):`,
    ...lines,
    '',
    'См. src/lib/validate-env.ts → REQUIRED_IN_PROD.',
  ].join('\n');

  if (process.env.NODE_ENV === 'production') {
    // Не используем logger — он сам зависит от env (LOG_LEVEL). Falling back на stderr.
    process.stderr.write(`\n❌ ENV VALIDATION FAILED\n${msg}\n\n`);
    throw new Error(msg);
  } else {
    process.stderr.write(`\n⚠️  ENV VALIDATION (dev, не блокирует)\n${msg}\n\n`);
  }
}
