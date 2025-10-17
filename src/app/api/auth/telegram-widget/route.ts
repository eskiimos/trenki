import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import prisma from '@/lib/prisma';

const BOT_TOKEN = process.env.BOT_TOKEN!;

// Проверка подписи Telegram Login Widget
function verifyTelegramLoginWidget(data: any): boolean {
  const { hash, ...authData } = data;
  
  // Создаём строку для проверки
  const dataCheckString = Object.keys(authData)
    .sort()
    .map(key => `${key}=${authData[key]}`)
    .join('\n');
  
  // Создаём секретный ключ
  const secretKey = crypto
    .createHash('sha256')
    .update(BOT_TOKEN)
    .digest();
  
  // Вычисляем хэш
  const calculatedHash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');
  
  return calculatedHash === hash;
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    
    console.log('🔐 Telegram Login Widget data received:', data);
    
    // Проверяем обязательные поля
    if (!data.id || !data.hash) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    // Проверяем подпись
    if (!verifyTelegramLoginWidget(data)) {
      console.error('❌ Invalid signature!');
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }
    
    console.log('✅ Signature verified!');
    
    // Проверяем, что данные не старше 24 часов
    const authDate = parseInt(data.auth_date);
    const now = Math.floor(Date.now() / 1000);
    if (now - authDate > 86400) {
      console.error('❌ Auth data too old');
      return NextResponse.json(
        { error: 'Auth data expired' },
        { status: 401 }
      );
    }
    
    // Сохраняем/обновляем пользователя в БД
    const user = await prisma.user.upsert({
      where: { telegramId: data.id.toString() },
      update: {
        firstName: data.first_name,
        lastName: data.last_name,
        username: data.username,
        updatedAt: new Date(),
      },
      create: {
        telegramId: data.id.toString(),
        firstName: data.first_name,
        lastName: data.last_name,
        username: data.username,
      },
      include: {
        profile: true,
      },
    });
    
    console.log('✅ User saved to database:', user.id);
    
    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        telegramId: user.telegramId,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
      },
    });
    
  } catch (error) {
    console.error('❌ Error in telegram-widget auth:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
