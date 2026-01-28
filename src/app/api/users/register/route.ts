import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { telegramId, firstName, lastName, birthDate, gender } = body;

    console.log('Register user:', { telegramId, firstName, lastName, birthDate, gender });

    if (!telegramId || !firstName || !lastName || !birthDate || !gender) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      );
    }
    
    // Вычисляем ageGroup из даты рождения
    const { calculateAgeData, isValidBirthDate } = await import('@/lib/age-utils');
    
    console.log('📅 Birth date received:', birthDate, 'Type:', typeof birthDate);
    console.log('📅 Validating birth date...');
    
    if (!isValidBirthDate(birthDate)) {
      console.error('❌ Invalid birth date:', birthDate);
      return NextResponse.json(
        { error: 'Invalid birth date' },
        { status: 400 }
      );
    }
    
    console.log('✅ Birth date valid');
    const { age, ageGroup } = calculateAgeData(birthDate);
    console.log('📊 Calculated:', { age, ageGroup });

    // Конвертируем gender в enum формат
    let genderEnum: 'MALE' | 'FEMALE' | 'NOT_SPECIFIED';
    if (gender === 'male') {
      genderEnum = 'MALE';
    } else if (gender === 'female') {
      genderEnum = 'FEMALE';
    } else {
      genderEnum = 'NOT_SPECIFIED';
    }

    console.log('🔄 Upserting user with data:', {
      telegramId,
      firstName,
      lastName,
      birthDate,
      ageGroup,
      gender: genderEnum
    });

    // Создаем или обновляем пользователя и профиль
    const user = await prisma.user.upsert({
      where: { telegramId },
      update: {
        firstName,
        lastName,
        profile: {
          upsert: {
            create: {
              birthDate: new Date(birthDate),
              ageGroup,
              gender: genderEnum,
            },
            update: {
              birthDate: new Date(birthDate),
              ageGroup,
              gender: genderEnum,
            },
          },
        },
      },
      create: {
        telegramId,
        firstName,
        lastName,
        profile: {
          create: {
            birthDate: new Date(birthDate),
            ageGroup,
            gender: genderEnum,
          },
        },
      },
      include: {
        profile: true,
      },
    });

    console.log('✅ User registered successfully:', {
      id: user.id,
      telegramId: user.telegramId,
      firstName: user.firstName,
      lastName: user.lastName,
      profile: user.profile
    });

    return NextResponse.json({
      success: true,
      user,
    });
  } catch (error) {
    console.error('❌ Error registering user:', error);
    console.error('Error type:', error instanceof Error ? error.constructor.name : typeof error);
    console.error('Error message:', error instanceof Error ? error.message : JSON.stringify(error));
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack');
    
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : 'Unknown error',
        type: error instanceof Error ? error.constructor.name : typeof error
      },
      { status: 500 }
    );
  }
}
