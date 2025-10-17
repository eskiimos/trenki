import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import prisma from '@/lib/prisma';

const BOT_TOKEN = process.env.BOT_TOKEN!;

// Функция проверки подписи Telegram WebApp initData
function verifyTelegramWebAppData(initData: string): any {
  const urlParams = new URLSearchParams(initData);
  const hash = urlParams.get('hash');
  urlParams.delete('hash');
  
  // Сортируем параметры
  const dataCheckString = Array.from(urlParams.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  
  // Создаём секретный ключ
  const secretKey = crypto
    .createHmac('sha256', 'WebAppData')
    .update(BOT_TOKEN)
    .digest();
  
  // Проверяем подпись
  const calculatedHash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');
  
  if (calculatedHash !== hash) {
    throw new Error('Invalid hash');
  }
  
  // Парсим данные пользователя
  const userJson = urlParams.get('user');
  if (!userJson) {
    throw new Error('No user data');
  }
  
  return JSON.parse(userJson);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { initData } = body;
    
    if (!initData) {
      return NextResponse.json(
        { error: 'No initData provided' },
        { status: 400 }
      );
    }
    
    console.log('🔐 Verifying Telegram WebApp initData...');
    
    // Проверяем подпись
    let userData;
    try {
      userData = verifyTelegramWebAppData(initData);
    } catch (error) {
      console.error('❌ Invalid Telegram signature:', error);
      return NextResponse.json(
        { error: 'Invalid Telegram signature' },
        { status: 401 }
      );
    }
    
    console.log('✅ Telegram signature verified!');
    console.log('👤 User data:', userData);
    
    // Сохраняем/обновляем пользователя в БД
    const user = await prisma.user.upsert({
      where: { telegramId: userData.id.toString() },
      update: {
        firstName: userData.first_name,
        lastName: userData.last_name,
        username: userData.username,
        updatedAt: new Date(),
      },
      create: {
        telegramId: userData.id.toString(),
        firstName: userData.first_name,
        lastName: userData.last_name,
        username: userData.username,
      },
      include: {
        profile: true,
      },
    });
    
    console.log('✅ User saved to database:', user.id);
    
    // Возвращаем данные пользователя
    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        telegramId: user.telegramId,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        profile: user.profile,
      },
    });
    
  } catch (error) {
    console.error('❌ Error in auth verification:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
