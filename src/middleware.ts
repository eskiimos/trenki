import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Публичные маршруты, которые доступны без авторизации
const publicRoutes = [
  '/login',
  '/api/auth/create-login-token',
  '/api/auth/check-login-token',
  '/api/telegram',
];

// Проверяем, является ли маршрут публичным
function isPublicRoute(pathname: string): boolean {
  return publicRoutes.some(route => pathname.startsWith(route));
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 🔓 Пропускаем localhost без проверки авторизации (для разработки)
  const hostname = request.nextUrl.hostname;
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
  
  if (isLocalhost) {
    console.log(`🔓 Middleware: localhost detected, skipping auth check`);
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
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
