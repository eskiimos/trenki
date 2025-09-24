import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const telegramId = searchParams.get('telegramId');

    if (!telegramId) {
      return NextResponse.json({ error: 'telegramId required' }, { status: 400 });
    }

    // Ищем пользователя с профилем
    let user = await prisma.user.findUnique({
      where: { telegramId },
      include: { profile: true }
    });

    // Если пользователя нет, создаем
    if (!user) {
      user = await prisma.user.create({
        data: {
          telegramId,
          profile: {
            create: {
              // Значения по умолчанию
              strength: 16,
              endurance: 22,
              speed: 55,
              technique: 22,
              overall: 28,
              dailyProgress: 8,
              maxDailyGoal: 10
            }
          }
        },
        include: { profile: true }
      });
    }

    // Если профиля нет, создаем
    if (!user.profile) {
      await prisma.profile.create({
        data: {
          userId: user.id,
          strength: 16,
          endurance: 22,
          speed: 55,
          technique: 22,
          overall: 28,
          dailyProgress: 8,
          maxDailyGoal: 10
        }
      });

      // Перезапрашиваем пользователя с профилем
      user = await prisma.user.findUnique({
        where: { telegramId },
        include: { profile: true }
      });
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { telegramId, firstName, lastName, username, profile } = body;

    if (!telegramId) {
      return NextResponse.json({ error: 'telegramId required' }, { status: 400 });
    }

    // Обновляем или создаем пользователя и профиль
    const user = await prisma.user.upsert({
      where: { telegramId },
      update: {
        firstName,
        lastName,
        username,
        profile: profile ? {
          upsert: {
            create: profile,
            update: profile
          }
        } : undefined
      },
      create: {
        telegramId,
        firstName,
        lastName,
        username,
        profile: profile ? {
          create: profile
        } : {
          create: {
            strength: 16,
            endurance: 22,
            speed: 55,
            technique: 22,
            overall: 28,
            dailyProgress: 8,
            maxDailyGoal: 10
          }
        }
      },
      include: { profile: true }
    });

    return NextResponse.json({ user });
  } catch (error) {
    console.error('Error updating user profile:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
