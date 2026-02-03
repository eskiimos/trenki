import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

// Админские учетные данные (загружаются из переменных окружения)
const ADMIN_LOGIN = process.env.ADMIN_LOGIN || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin';

// Хранилище активных сессий (в production используйте DB или Redis)
const adminSessions = new Map<string, { loginTime: number }>();
const SESSION_TOKEN_LENGTH = 32;
const SESSION_DURATION = 1000 * 60 * 60 * 24 * 7; // 7 дней

/**
 * Генерирует уникальный токен сессии
 */
function generateSessionToken(): string {
  return crypto.randomBytes(SESSION_TOKEN_LENGTH).toString('hex');
}

/**
 * Проверяет валидность токена сессии
 */
function validateSessionToken(token: string): boolean {
  if (!adminSessions.has(token)) {
    return false;
  }
  
  const session = adminSessions.get(token)!;
  const age = Date.now() - session.loginTime;
  
  // Если сессия истекла, удаляем её
  if (age > SESSION_DURATION) {
    adminSessions.delete(token);
    return false;
  }
  
  return true;
}

/**
 * POST /api/admin/auth
 * Проверяет логин/пароль и возвращает токен сессии
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { login, password } = body;

    // Базовая валидация
    if (!login || !password) {
      return NextResponse.json(
        { error: 'Login and password are required' },
        { status: 400 }
      );
    }

    // Проверка учетных данных
    if (login !== ADMIN_LOGIN || password !== ADMIN_PASSWORD) {
      console.error(`❌ Failed admin login attempt: ${login}`);
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    console.log('✅ Admin login successful');

    // Генерируем токен сессии
    const token = generateSessionToken();
    adminSessions.set(token, { loginTime: Date.now() });

    // Возвращаем токен с установкой cookie
    const response = NextResponse.json({ 
      success: true,
      token 
    });

    // Устанавливаем cookie (httpOnly для безопасности)
    response.cookies.set('admin_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: SESSION_DURATION / 1000, // в секундах
      path: '/'
    });

    return response;
  } catch (error) {
    console.error('Error in admin auth:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/auth
 * Проверяет валидность текущей сессии
 */
export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('admin_token')?.value;

    if (!token) {
      console.log('🔐 No admin token in cookies');
      return NextResponse.json(
        { authenticated: false },
        { status: 401 }
      );
    }

    if (!validateSessionToken(token)) {
      console.log('🔐 Admin token is invalid or expired');
      return NextResponse.json(
        { authenticated: false },
        { status: 401 }
      );
    }

    // Продляем время сессии (обновляем loginTime каждый раз при проверке)
    const session = adminSessions.get(token)!;
    session.loginTime = Date.now();

    return NextResponse.json({ 
      authenticated: true 
    });
  } catch (error) {
    console.error('Error checking admin session:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/auth
 * Выход из админки (удаление сессии)
 */
export async function DELETE(request: NextRequest) {
  try {
    const token = request.cookies.get('admin_token')?.value;

    if (token) {
      adminSessions.delete(token);
      console.log('✅ Admin logged out');
    }

    const response = NextResponse.json({ 
      success: true,
      message: 'Logged out'
    });

    // Удаляем cookie
    response.cookies.delete('admin_token');

    return response;
  } catch (error) {
    console.error('Error logging out admin:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
