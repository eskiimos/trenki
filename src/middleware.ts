import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Публичные маршруты, которые доступны без авторизации
const publicRoutes = [
  '/login',
  '/api/auth/create-login-token',
  '/api/auth/check-login-token',
  '/api/auth/email/send-code',
  '/api/auth/email/verify-code',
  '/api/telegram',
];

// Проверяем, является ли маршрут публичным
function isPublicRoute(pathname: string): boolean {
  return publicRoutes.some(route => pathname.startsWith(route));
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hostname = request.nextUrl.hostname;

  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';

  // ─── Субдомен adaptive.trenki.app ───────────────────────────────────────
  const isAdaptive =
    hostname === 'adaptive.trenki.app' ||
    (isLocalhost && request.nextUrl.searchParams.get('subdomain') === 'adaptive');

  if (isAdaptive) {
    // Пропускаем API и статику
    if (pathname.startsWith('/api') || pathname.startsWith('/_next')) {
      return NextResponse.next();
    }

    // Публичные маршруты adaptive (без авторизации)
    const adaptivePublicPaths = ['/adaptive', '/adaptive/login', '/adaptive/about'];
    const resolvedPath = pathname.startsWith('/adaptive') ? pathname : `/adaptive${pathname === '/' ? '' : pathname}`;
    const isPublicAdaptive = adaptivePublicPaths.some(p => resolvedPath === p || resolvedPath === p + '/');

    // Проверяем авторизацию для защищённых страниц
    if (!isPublicAdaptive) {
      const telegramId = request.cookies.get('telegramId')?.value;
      if (!telegramId) {
        const loginUrl = request.nextUrl.clone();
        loginUrl.pathname = '/adaptive/login';
        return NextResponse.redirect(loginUrl);
      }
    }

    // Уже на /adaptive/* — не трогаем
    if (pathname.startsWith('/adaptive')) {
      return NextResponse.next();
    }
    // Реврайт: / → /adaptive, /login → /adaptive/login и т.д.
    const url = request.nextUrl.clone();
    url.pathname = `/adaptive${pathname === '/' ? '' : pathname}`;
    return NextResponse.rewrite(url);
  }
  // ────────────────────────────────────────────────────────────────────────

  // 🔓 В dev-окружении пропускаем localhost без проверки авторизации.
  // В проде НИКОГДА не пропускаем по hostname — иначе обратный прокси
  // с Host: localhost обходит middleware.
  if (isLocalhost && process.env.NODE_ENV !== 'production') {
    console.log(`🔓 Middleware: localhost (dev), skipping auth check`);
    return NextResponse.next();
  }

  // Пропускаем статические файлы и API маршруты (кроме защищённых)
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname.includes('/api/') && !pathname.includes('/api/users/')
  ) {
    return NextResponse.next();
  }

  // Пропускаем публичные маршруты
  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }

  // Проверяем авторизацию (инвайт-коды отключены)
  const telegramId = request.cookies.get('telegramId')?.value;

  // Если пользователь не авторизован, редиректим на /login
  if (!telegramId && pathname !== '/login') {
    console.log(`🔒 Middleware: Неавторизованный доступ к ${pathname}, редирект на /login`);
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

// Настраиваем, к каким маршрутам применяется middleware
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|manifest\\.json|sw\\.js|robots\\.txt|icons/|images/|avatars/|logos/|video/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|js|css|woff|woff2|ttf)$).*)',
  ],
};
