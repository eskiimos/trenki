import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const telegramId = searchParams.get('telegramId');

    console.log('Checking user with telegramId:', telegramId);

    if (!telegramId) {
      console.log('No telegramId provided');
      return NextResponse.json(
        { error: 'Telegram ID is required' },
        { status: 400 }
      );
    }

    // Проверяем, существует ли пользователь и его профиль
    const user = await prisma.user.findUnique({
      where: { telegramId },
      select: { 
        id: true, 
        telegramId: true, 
        firstName: true,
        profile: {
          select: {
            age: true,
            gender: true
          }
        }
      }
    });

    console.log('User found:', user ? 'Yes' : 'No');
    console.log('User details:', JSON.stringify(user, null, 2));

    return NextResponse.json({
      exists: !!user,
      user: user
    });
  } catch (error) {
    console.error('Error checking user:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
