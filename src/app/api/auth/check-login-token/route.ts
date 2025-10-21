import { NextRequest, NextResponse } from 'next/server';

// Используем глобальное хранилище токенов
declare global {
  var loginTokens: Map<string, { createdAt: number; authenticated: boolean; userId?: string; userData?: any; needsOnboarding?: boolean }>;
}

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        { error: 'Token is required' },
        { status: 400 }
      );
    }

    const tokenData = global.loginTokens?.get(token);

    if (!tokenData) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 404 }
      );
    }

    // Проверяем, не истек ли токен (5 минут)
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    if (tokenData.createdAt < fiveMinutesAgo) {
      global.loginTokens.delete(token);
      return NextResponse.json(
        { error: 'Token expired' },
        { status: 410 }
      );
    }

    // Если токен не аутентифицирован, возвращаем статус pending
    if (!tokenData.authenticated) {
      return NextResponse.json({
        authenticated: false,
        status: 'pending',
      });
    }

    // Токен аутентифицирован, возвращаем данные пользователя
    return NextResponse.json({
      authenticated: true,
      user: tokenData.userData,
      needsOnboarding: tokenData.needsOnboarding || false,
    });
  } catch (error) {
    console.error('Error checking login token:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
