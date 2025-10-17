import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { telegramId, firstName, lastName, age, gender, email, emailVerified } = body;

    console.log('Register user:', { telegramId, firstName, lastName, age, gender, email, emailVerified });

    if (!telegramId || !firstName || !lastName || !age || !gender) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      );
    }

    // Конвертируем gender в enum формат
    let genderEnum: 'MALE' | 'FEMALE' | 'NOT_SPECIFIED';
    if (gender === 'male') {
      genderEnum = 'MALE';
    } else if (gender === 'female') {
      genderEnum = 'FEMALE';
    } else {
      genderEnum = 'NOT_SPECIFIED';
    }

    // Создаем или обновляем пользователя и профиль
    const user = await prisma.user.upsert({
      where: { telegramId },
      update: {
        firstName,
        lastName,
        email: email || undefined,
        emailVerified: emailVerified || false,
        profile: {
          upsert: {
            create: {
              age: parseInt(age),
              gender: genderEnum,
            },
            update: {
              age: parseInt(age),
              gender: genderEnum,
            },
          },
        },
      },
      create: {
        telegramId,
        firstName,
        lastName,
        email: email || undefined,
        emailVerified: emailVerified || false,
        profile: {
          create: {
            age: parseInt(age),
            gender: genderEnum,
          },
        },
      },
      include: {
        profile: true,
      },
    });

    console.log('User registered:', user);

    return NextResponse.json({
      success: true,
      user,
    });
  } catch (error) {
    console.error('Error registering user:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
