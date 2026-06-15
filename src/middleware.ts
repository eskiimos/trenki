import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSessionFromRequest, SESSION_COOKIE_NAME } from '@/lib/session';
import { ADMIN_COOKIE_NAME } from '@/lib/admin-cookie';

// Публичные маршруты, доступные без авторизации
const publicRoutes = [
  '/login',
  '/landing',
  '/legal',
  '/join',
  '/admin/login',
  '/api/auth/email/send-code',
  '/api/auth/email/verify-code',
  '/api/auth/logout',
  '/api/admin/auth',
  '/api/health',
];

function isPublicRoute(pathname: string): boolean {
  return publicRoutes.some(route => pathname.startsWith(route));
}

/** Случайный base64-nonce для CSP. */
function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

/**
 * Собирает Content-Security-Policy.
 *
 * — script-src: 'self' + nonce. `'strict-dynamic'` нужен, чтобы Next.js inline-bootstrap
 *   (с nonce) мог подгружать остальные чанки без перечисления хостов; mc.yandex.ru
 *   (Метрика) явно разрешён.
 * — connect-src: API Kinescope, CDN MediaPipe, Метрика, наш origin.
 * — img-src: + Cloudinary, Kinescope thumbnails, placehold.co, data:/blob:.
 * — frame-src: kinescope.io (плеер).
 * — style-src 'unsafe-inline' нужен для Tailwind/next/font, в dev — ещё 'unsafe-eval'.
 */
function buildCsp(nonce: string, isDev: boolean): string {
  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],
    'script-src': [
      "'self'",
      `'nonce-${nonce}'`,
      "'strict-dynamic'",
      'https://mc.yandex.ru',
      'https://mc.webvisor.com',
      'https://cdn.jsdelivr.net',
      ...(isDev ? ["'unsafe-eval'"] : []),
    ],
    'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
    'font-src': ["'self'", 'data:', 'https://fonts.gstatic.com'],
    'img-src': [
      "'self'",
      'data:',
      'blob:',
      'https://res.cloudinary.com',
      'https://kinescope.io',
      'https://*.kinescope.io',
      'https://kinescopecdn.net',
      'https://placehold.co',
      'https://mc.yandex.ru',
      'https://mc.webvisor.com',
    ],
    'media-src': [
      "'self'",
      'blob:',
      'data:',
      'https://kinescope.io',
      'https://*.kinescope.io',
      'https://kinescopecdn.net',
    ],
    'connect-src': [
      "'self'",
      'https://api.kinescope.io',
      'https://uploader.kinescope.io',
      'https://*.kinescope.io',
      'https://kinescopecdn.net',
      'https://cdn.jsdelivr.net',
      'https://storage.googleapis.com',
      'https://mc.yandex.ru',
      'https://mc.webvisor.com',
      'wss://mc.webvisor.com',
    ],
    'frame-src': ["'self'", 'https://kinescope.io', 'https://*.kinescope.io', 'https://mc.yandex.ru'],
    'worker-src': ["'self'", 'blob:'],
    'manifest-src': ["'self'"],
    'frame-ancestors': ["'self'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'object-src': ["'none'"],
  };
  const parts = Object.entries(directives).map(([k, v]) => `${k} ${v.join(' ')}`);
  if (!isDev) parts.push('upgrade-insecure-requests');
  return parts.join('; ');
}

function applySecurityHeaders(response: NextResponse, nonce: string, isDev: boolean): void {
  // CSP — только для HTML-страниц (мы здесь, потому что middleware матчит non-API non-static).
  // В dev CSP мешает HMR — оставляем только в production.
  if (!isDev) {
    response.headers.set('Content-Security-Policy', buildCsp(nonce, false));
  }
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'SAMEORIGIN');
  response.headers.set(
    'Permissions-Policy',
    'camera=(self), microphone=(), geolocation=(), interest-cohort=()',
  );
  if (!isDev) {
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hostname = request.nextUrl.hostname;
  const isDev = process.env.NODE_ENV !== 'production';
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';

  const nonce = generateNonce();
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  // Пробрасываем pathname в server components (для admin layout и проч.)
  requestHeaders.set('x-pathname', pathname);

  // Хелпер, который наращивает security headers на любой возвращаемый response.
  const withSecurity = (resp: NextResponse): NextResponse => {
    applySecurityHeaders(resp, nonce, isDev);
    return resp;
  };

  const passThrough = () =>
    withSecurity(NextResponse.next({ request: { headers: requestHeaders } }));

  // ─── Субдомен adaptive.trenki.app ───────────────────────────────────────
  const isAdaptive =
    hostname === 'adaptive.trenki.app' ||
    (isLocalhost && request.nextUrl.searchParams.get('subdomain') === 'adaptive');

  if (isAdaptive) {
    if (pathname.startsWith('/api') || pathname.startsWith('/_next')) {
      return passThrough();
    }

    const adaptivePublicPaths = ['/adaptive', '/adaptive/login', '/adaptive/about'];
    const resolvedPath = pathname.startsWith('/adaptive')
      ? pathname
      : `/adaptive${pathname === '/' ? '' : pathname}`;
    const isPublicAdaptive = adaptivePublicPaths.some(
      p => resolvedPath === p || resolvedPath === p + '/',
    );

    if (!isPublicAdaptive) {
      const session = await getSessionFromRequest(request);
      if (!session) {
        const loginUrl = request.nextUrl.clone();
        loginUrl.pathname = '/adaptive/login';
        return withSecurity(NextResponse.redirect(loginUrl));
      }
    }

    if (pathname.startsWith('/adaptive')) {
      return passThrough();
    }
    const url = request.nextUrl.clone();
    url.pathname = `/adaptive${pathname === '/' ? '' : pathname}`;
    return withSecurity(NextResponse.rewrite(url, { request: { headers: requestHeaders } }));
  }
  // ────────────────────────────────────────────────────────────────────────

  // В dev пропускаем localhost без проверки auth. В проде НИКОГДА.
  if (isLocalhost && isDev) {
    return passThrough();
  }

  // Статика и API (защита API делается в самих роутах через guards)
  if (pathname.startsWith('/_next') || pathname.startsWith('/static') || pathname.startsWith('/api/')) {
    return passThrough();
  }

  if (isPublicRoute(pathname)) {
    return passThrough();
  }

  // Защита /admin/* (кроме самой страницы логина).
  // Тут проверяем только наличие admin_token cookie ИЛИ обычной сессии
  // (последняя нужна для юзеров с user.isAdmin=true, которые заходят без
  // login+password). Реальная валидация токена/прав делается в API/layout —
  // middleware на edge не может ходить в Prisma.
  if (pathname.startsWith('/admin') && pathname !== '/admin/login') {
    const hasAdminCookie = Boolean(request.cookies.get(ADMIN_COOKIE_NAME)?.value);
    const hasUserSession = Boolean(request.cookies.get(SESSION_COOKIE_NAME)?.value);
    if (!hasAdminCookie && !hasUserSession) {
      const loginUrl = new URL('/admin/login', request.url);
      return withSecurity(NextResponse.redirect(loginUrl));
    }
    return passThrough();
  }

  // Проверяем подписанную сессию
  const session = await getSessionFromRequest(request);
  if (!session && pathname !== '/login') {
    const loginUrl = new URL('/login', request.url);
    const response = NextResponse.redirect(loginUrl);
    response.cookies.delete('telegramId');
    response.cookies.delete(SESSION_COOKIE_NAME);
    return withSecurity(response);
  }

  return passThrough();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|manifest\\.json|sw\\.js|robots\\.txt|icons/|images/|avatars/|logos/|video/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|js|css|woff|woff2|ttf)$).*)',
  ],
};
