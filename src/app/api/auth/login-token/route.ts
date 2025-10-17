import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

// Глобальное хранилище для login токенов (для продакшена лучше использовать Redis)
declare global {
  var loginTokensStore: Map<string, {
    telegramId?: string;
    expiresAt: number;
  }>;
  var loginTokensCleanupInterval: NodeJS.Timeout | null;
}

// Инициализируем глобальное хранилище
if (!global.loginTokensStore) {
  global.loginTokensStore = new Map();
}

// Очистка истёкших токенов (только раз)
if (!global.loginTokensCleanupInterval) {
  global.loginTokensCleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [token, data] of global.loginTokensStore.entries()) {
      if (data.expiresAt < now) {
        global.loginTokensStore.delete(token);
      }
    }
  }, 60000); // Каждую минуту
}

// Генерация login токена
export async function POST(request: NextRequest) {
  try {
    // Генерируем уникальный токен
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5 минут

    // Сохраняем токен в глобальном хранилище
    global.loginTokensStore.set(token, { expiresAt });

    console.log(`✅ Generated login token: ${token.substring(0, 8)}...`);

    return NextResponse.json({ token });
  } catch (error) {
    console.error('Error generating login token:', error);
    return NextResponse.json(
      { error: 'Failed to generate login token' },
      { status: 500 }
    );
  }
}

// Проверка и активация токена
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        { error: 'Token is required' },
        { status: 400 }
      );
    }

    // Проверяем токен
    const tokenData = global.loginTokensStore.get(token);

    if (!tokenData || tokenData.expiresAt < Date.now()) {
      // Удаляем истёкший токен
      if (tokenData) {
        global.loginTokensStore.delete(token);
      }
      
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    if (!tokenData.telegramId) {
      // Токен ещё не активирован
      return NextResponse.json({
        status: 'pending',
        message: 'Waiting for user confirmation in Telegram',
      });
    }

    // Токен активирован, возвращаем telegram_id
    // Удаляем использованный токен
    global.loginTokensStore.delete(token);

    console.log(`✅ Login token verified for Telegram ID: ${tokenData.telegramId}`);

    return NextResponse.json({
      status: 'success',
      telegramId: tokenData.telegramId,
    });
  } catch (error) {
    console.error('Error checking login token:', error);
    return NextResponse.json(
      { error: 'Failed to check login token' },
      { status: 500 }
    );
  }
}
