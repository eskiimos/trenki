/**
 * Next.js 16 server-side init hook.
 * Вызывается один раз при холодном старте сервера (Node-runtime).
 *
 * Тут мы валидируем env: если в production не хватает обязательных
 * переменных, throw → контейнер падает сразу и docker compose рестартит
 * его (или сигналит в healthcheck), вместо того чтобы тихо отвечать 500
 * на первый запрос пользователя.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { validateProductionEnv } = await import('./src/lib/validate-env');
    validateProductionEnv();
  }
}
