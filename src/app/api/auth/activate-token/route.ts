import { NextRequest, NextResponse } from 'next/server';

// Импортируем то же хранилище (в продакшене использовать Redis)
// Временное решение - экспортируем хранилище из login-token/route.ts
// Для простоты сделаем глобальное хранилище
declare global {
  var loginTokensStore: Map<string, {
    telegramId?: string;
    expiresAt: number;
  }>;
}

// Инициализируем глобальное хранилище
if (!global.loginTokensStore) {
  global.loginTokensStore = new Map();
}

export async function POST(request: NextRequest) {
  try {
    const { token, telegramId } = await request.json();

    if (!token || !telegramId) {
      return NextResponse.json(
        { error: 'Token and telegramId are required' },
        { status: 400 }
      );
    }

    // Проверяем, что токен существует и не истёк
    const tokenData = global.loginTokensStore.get(token);

    if (!tokenData || tokenData.expiresAt < Date.now()) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    if (tokenData.telegramId) {
      return NextResponse.json(
        { error: 'Token already activated' },
        { status: 400 }
      );
    }

    // Активируем токен - записываем telegram_id
    tokenData.telegramId = telegramId.toString();
    global.loginTokensStore.set(token, tokenData);

    console.log(`✅ Activated login token for Telegram ID: ${telegramId}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error activating login token:', error);
    return NextResponse.json(
      { error: 'Failed to activate login token' },
      { status: 500 }
    );
  }
}
