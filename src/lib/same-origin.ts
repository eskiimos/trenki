import type { NextRequest } from 'next/server';

/**
 * Проверка «запрос пришёл с нашей же страницы» для мутирующих POST-роутов.
 *
 * SameSite=Lax режет классический cross-site POST, но НЕ спасает от запросов с
 * нашего же поддомена (в проекте есть adaptive.trenki.app): для cookie это
 * same-site. Поэтому дополнительно сверяем Origin с фактическим хостом.
 *
 * Сравниваем именно Origin (его нельзя подделать из браузера), а не Referer.
 * Отсутствие Origin трактуем как небраузерный вызов — для этих роутов запрещаем.
 */
export function isSameOrigin(
  request: NextRequest,
  opts: {
    /**
     * Пропускать запрос без заголовка Origin.
     *
     * Для НАШИХ новых роутов (switch/remove) — false: их зовёт только наш fetch,
     * который Origin шлёт всегда, поэтому строгий режим безопасен.
     *
     * Для БОЕВОГО ЛОГИНА — true: браузерный CSRF всё равно невозможен без
     * Origin (браузер его проставляет), а жёсткий отказ рисковал бы закрыть
     * вход экзотическому webview/клиенту. Цена ошибки несимметрична.
     */
    allowMissingOrigin?: boolean;
  } = {},
): boolean {
  const origin = request.headers.get('origin');
  if (!origin) {
    return opts.allowMissingOrigin === true;
  }
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    return false;
  }
  // Сверяем с `host`: его выставляет наш nginx (`proxy_set_header Host $host`).
  // `x-forwarded-host` в конфиге НЕ выставляется, значит клиентский заголовок
  // прошёл бы насквозь — доверять ему нельзя (тривиальный обход через curl).
  // Явный APP_ORIGIN (если задан) имеет приоритет над обоими.
  // APP_ORIGIN — СПИСОК через запятую (например
  // `https://trenki.app,https://www.trenki.app,https://adaptive.trenki.app`).
  // Именно список, а не одно значение: на 443 нет редиректа www→apex, и один
  // жёсткий origin молча ломал бы вход всем, кто пришёл на www.
  const appOrigins = (process.env.APP_ORIGIN || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (appOrigins.length > 0) {
    const allowed = appOrigins
      .map((o) => {
        try {
          return new URL(o).host;
        } catch {
          return null;
        }
      })
      .filter((h): h is string => !!h);
    if (allowed.length > 0) return allowed.includes(originHost);
    // все значения битые — падаем на сверку с host ниже
  }
  const host = request.headers.get('host');
  return !!host && originHost === host;
}
