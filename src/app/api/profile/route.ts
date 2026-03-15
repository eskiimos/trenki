import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { updateUserActivity } from '@/lib/updateUserActivity';

export async function GET(request: NextRequest) {
  try {
    console.log('=== GET /api/profile START ===');
    const { searchParams } = new URL(request.url);
    const telegramId = searchParams.get('telegramId');
    console.log('Requested telegramId:', telegramId);

    if (!telegramId) {
      console.log('ERROR: telegramId not provided');
      return NextResponse.json({ error: 'telegramId required' }, { status: 400 });
    }

    // Ищем пользователя с профилем
    console.log('Searching for user in database...');
    let user = await prisma.user.findUnique({
      where: { telegramId },
      include: { profile: true }
    });
    console.log('User found:', user ? 'Yes' : 'No', user?.id);

    // Если пользователя нет, создаем
    if (!user) {
      console.log('User not found, creating new user...');
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
      console.log('New user created:', user.id);
    }

    // Если профиля нет, создаем
    if (!user.profile) {
      console.log('Profile not found for user, creating...');
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
      console.log('Refetching user with profile...');
      user = await prisma.user.findUnique({
        where: { telegramId },
        include: { profile: true }
      });
      console.log('User refetched with profile');
    }

    // Обновляем активность пользователя
    await updateUserActivity(telegramId);

    console.log('=== GET /api/profile SUCCESS ===');
    return NextResponse.json({ user });
  } catch (error) {
    console.error('=== GET /api/profile ERROR ===');
    console.error('Error fetching user profile:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('=== POST /api/profile START ===');
    console.log('NODE_ENV:', process.env.NODE_ENV);
    console.log('DATABASE_URL exists:', !!process.env.DATABASE_URL);
    console.log('Request URL:', request.url);
    console.log('Request headers:', Object.fromEntries(request.headers.entries()));
    
    let body;
    try {
      body = await request.json();
      console.log('POST /api/profile - Received body:', JSON.stringify(body, null, 2));
    } catch (parseError) {
      console.error('POST /api/profile - Failed to parse JSON body:', parseError);
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }
    
    const { telegramId, firstName, lastName, username, profile } = body;

    if (!telegramId) {
      console.log('POST /api/profile - Missing telegramId');
      return NextResponse.json({ error: 'telegramId required' }, { status: 400 });
    }

    console.log('POST /api/profile - Starting database operation...');
    console.log('POST /api/profile - telegramId:', telegramId);
    console.log('POST /api/profile - firstName:', firstName);
    console.log('POST /api/profile - lastName:', lastName);
    console.log('POST /api/profile - username:', username);
    console.log('POST /api/profile - profile:', profile);

    // Нормализуем данные профиля (преобразуем пустые строки в null)
    let normalizedProfile = null;
    if (profile) {
      const { calculateAgeData, isValidBirthDate } = await import('@/lib/age-utils');
      
      // Вычисляем ageGroup если указана дата рождения
      let ageGroup = profile.ageGroup || null;
      if (profile.birthDate) {
        if (!isValidBirthDate(profile.birthDate)) {
          return NextResponse.json({ error: 'Invalid birth date' }, { status: 400 });
        }
        const { ageGroup: calculatedAgeGroup } = calculateAgeData(profile.birthDate);
        ageGroup = calculatedAgeGroup;
      }
      
      normalizedProfile = {
        ...profile,
        position: profile.position ? profile.position : null,
        number: profile.number ? parseInt(profile.number) : null,
        birthDate: profile.birthDate ? new Date(profile.birthDate) : null,
        ageGroup,
        height: profile.height ? parseInt(profile.height) : null,
        weight: profile.weight ? parseInt(profile.weight) : null,
        avatarUrl: profile.avatarUrl ? profile.avatarUrl : null,
        clubLogoUrl: profile.clubLogoUrl ? profile.clubLogoUrl : null,
      };
    }

    // Проверим подключение к базе данных
    try {
      await prisma.$connect();
      console.log('POST /api/profile - Database connected successfully');
    } catch (dbError) {
      console.error('POST /api/profile - Database connection failed:', dbError);
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
    }

    // Обновляем или создаем пользователя и профиль
    const user = await prisma.user.upsert({
      where: { telegramId },
      update: {
        firstName,
        lastName,
        username,
        profile: normalizedProfile ? {
          upsert: {
            create: normalizedProfile,
            update: normalizedProfile
          }
        } : undefined
      },
      create: {
        telegramId,
        firstName,
        lastName,
        username,
        profile: normalizedProfile ? {
          create: normalizedProfile
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

    console.log('POST /api/profile - User upserted successfully:', user.id);
    console.log('=== POST /api/profile SUCCESS ===');

    return NextResponse.json({ user });
  } catch (error: any) {
    console.error('=== POST /api/profile ERROR ===');
    console.error('Error type:', error?.constructor?.name);
    console.error('Error message:', error?.message);
    console.error('Error stack:', error?.stack);
    
    // Проверяем тип ошибки для более детального ответа
    if (error?.code === 'P2002') {
      console.error('Prisma unique constraint error:', error?.meta);
      return NextResponse.json({ error: 'Data conflict: user already exists with different parameters' }, { status: 409 });
    }
    
    if (error?.code === 'P2025') {
      console.error('Prisma record not found error:', error?.meta);
      return NextResponse.json({ error: 'Required record not found' }, { status: 404 });
    }
    
    if (error?.name === 'PrismaClientKnownRequestError') {
      console.error('Prisma known error:', error?.code, error?.meta);
      return NextResponse.json({ error: `Database error: ${error?.code}` }, { status: 500 });
    }
    
    if (error?.name === 'PrismaClientUnknownRequestError') {
      console.error('Prisma unknown error');
      return NextResponse.json({ error: 'Unknown database error' }, { status: 500 });
    }
    
    if (error?.name === 'PrismaClientRustPanicError') {
      console.error('Prisma rust panic error');
      return NextResponse.json({ error: 'Database engine error' }, { status: 500 });
    }

    return NextResponse.json({ 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error?.message : undefined
    }, { status: 500 });
  }
}
