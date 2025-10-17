import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import prisma from '@/lib/prisma';

interface TelegramAuthData {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

/**
 * Проверяет подпись данных от Telegram
 * Важно для безопасности!
 */
function verifyTelegramAuth(data: TelegramAuthData, botToken: string): boolean {
  const { hash, ...authData } = data;
  
  // Создаём строку для проверки
  const dataCheckString = Object.keys(authData)
    .sort()
    .map(key => `${key}=${authData[key as keyof typeof authData]}`)
    .join('\n');
  
  // Создаём secret key из токена бота
  const secretKey = crypto
    .createHash('sha256')
    .update(botToken)
    .digest();
  
  // Вычисляем hash
  const computedHash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');
  
  return computedHash === hash;
}

export async function POST(request: NextRequest) {
  try {
    const data: TelegramAuthData = await request.json();
    
    console.log('Telegram auth request:', data);

    // Проверяем наличие обязательных полей
    if (!data.id || !data.first_name || !data.auth_date || !data.hash) {
      return NextResponse.json(
        { error: 'Недостаточно данных от Telegram' },
        { status: 400 }
      );
    }

    // Проверяем, что данные не старые (не более 1 дня)
    const currentTime = Math.floor(Date.now() / 1000);
    if (currentTime - data.auth_date > 86400) {
      return NextResponse.json(
        { error: 'Данные авторизации устарели' },
        { status: 400 }
      );
    }

    // Проверяем подпись (если токен бота указан)
    const botToken = process.env.BOT_TOKEN;
    const isDevMode = process.env.NODE_ENV === 'development';
    const isTestUser = data.hash?.startsWith('test_hash_');
    
    if (botToken && !isTestUser) {
      const isValid = verifyTelegramAuth(data, botToken);
      if (!isValid) {
        console.error('Invalid Telegram auth signature');
        return NextResponse.json(
          { error: 'Неверная подпись данных' },
          { status: 403 }
        );
      }
      console.log('Telegram auth signature verified ✓');
    } else if (isTestUser && isDevMode) {
      console.log('DEV MODE: Skipping signature verification for test user');
    } else {
      console.warn('BOT_TOKEN not set, skipping signature verification');
    }

    const telegramId = data.id.toString();

    // Проверяем, существует ли пользователь
    let user = await prisma.user.findUnique({
      where: { telegramId },
      include: { profile: true },
    });

    // Если пользователя нет, создаём
    if (!user) {
      console.log('Creating new user:', telegramId);
      user = await prisma.user.create({
        data: {
          telegramId,
          firstName: data.first_name,
          lastName: data.last_name,
          username: data.username,
          profile: {
            create: {
              // Базовые значения
              strength: 0,
              endurance: 0,
              speed: 0,
              technique: 0,
              overall: 0,
              dailyProgress: 0,
              maxDailyGoal: 10,
            },
          },
        },
        include: { profile: true },
      });
      console.log('New user created:', user.id);
    } else {
      // Обновляем данные существующего пользователя
      console.log('Updating existing user:', user.id);
      user = await prisma.user.update({
        where: { telegramId },
        data: {
          firstName: data.first_name,
          lastName: data.last_name,
          username: data.username,
        },
        include: { profile: true },
      });
    }

    // Проверяем, заполнен ли профиль
    const needsOnboarding = !user.profile?.age || !user.profile?.gender;

    return NextResponse.json({
      success: true,
      user,
      needsOnboarding,
      message: needsOnboarding
        ? 'Необходимо заполнить профиль'
        : 'Авторизация успешна',
    });
  } catch (error) {
    console.error('Error in Telegram auth:', error);
    return NextResponse.json(
      {
        error: 'Ошибка сервера',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
