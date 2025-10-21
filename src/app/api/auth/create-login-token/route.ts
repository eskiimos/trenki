import { NextResponse } from 'next/server';
import crypto from 'crypto';

// Временное хранилище токенов (в продакшене использовать Redis)
declare global {
  var loginTokens: Map<string, { 
    createdAt: number; 
    authenticated: boolean; 
    userId?: string; 
    userData?: any;
    needsOnboarding?: boolean;
  }>;
}

if (!global.loginTokens) {
  global.loginTokens = new Map();
}

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    // Генерируем уникальный токен
    const token = crypto.randomBytes(32).toString('hex');
    
    // Сохраняем токен со временем создания (5 минут жизни)
    global.loginTokens.set(token, {
      createdAt: Date.now(),
      authenticated: false,
    });

    // Очищаем старые токены (старше 10 минут)
    const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
    for (const [key, value] of global.loginTokens.entries()) {
      if (value.createdAt < tenMinutesAgo) {
        global.loginTokens.delete(key);
      }
    }

    console.log('✅ Login token created:', token);

    return NextResponse.json({ token });
  } catch (error) {
    console.error('Error creating login token:', error);
    return NextResponse.json(
      { error: 'Failed to create login token' },
      { status: 500 }
    );
  }
}
