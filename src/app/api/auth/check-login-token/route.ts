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

    console.log('🔍 Checking token:', token);

    if (!token) {
      return NextResponse.json(
        { error: 'Token is required' },
        { status: 400 }
      );
    }

    const tokenData = global.loginTokens?.get(token);
    
    console.log('📊 Token data:', tokenData ? {
      authenticated: tokenData.authenticated,
      userId: tokenData.userId,
      createdAt: new Date(tokenData.createdAt).toISOString(),
    } : 'NOT FOUND');

    if (!tokenData) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 404 }
      );
    }

    // Проверяем, не истек ли токен (5 минут)
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    if (tokenData.createdAt < fiveMinutesAgo) {
      console.log('⏰ Token expired');
      global.loginTokens.delete(token);
      return NextResponse.json(
        { error: 'Token expired' },
        { status: 410 }
      );
    }

    // Если токен не аутентифицирован, возвращаем статус pending
    if (!tokenData.authenticated) {
      console.log('⏳ Token pending authentication');
      return NextResponse.json({
        authenticated: false,
        status: 'pending',
      });
    }

    // Токен аутентифицирован, возвращаем данные пользователя
    console.log('✅ Token authenticated, returning user data');
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
