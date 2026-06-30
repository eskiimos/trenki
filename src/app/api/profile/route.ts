import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { updateUserActivity } from '@/lib/updateUserActivity';
import { getSessionUserId } from '@/lib/auth-server';
import {
  isValidName,
  isValidGameNumber,
  NAME_MAX_FIRST,
  NAME_MAX_LAST,
  clampHeight,
  clampWeight,
} from '@/lib/profile-validation';

export async function GET(request: NextRequest) {
  try {
    const userId = await getSessionUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let user = await prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

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
          maxDailyGoal: 10,
        },
      });
      user = await prisma.user.findUnique({
        where: { id: userId },
        include: { profile: true },
      });
    }

    await updateUserActivity(user!.id);

    return NextResponse.json({ user });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getSessionUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }

    const { firstName, lastName, username, profile, email } = body;

    // Валидация имени/фамилии: только кириллица + дефис, минимум 2 буквы.
    // Защита от обхода клиентской маски — не доверяем телу запроса.
    // Не-строковые значения тоже отбиваем чистым 400 (иначе Prisma даст 500).
    if (firstName !== undefined && firstName !== null &&
        (typeof firstName !== 'string' || !isValidName(firstName, NAME_MAX_FIRST))) {
      return NextResponse.json(
        { error: 'Имя: только кириллица, минимум 2 символа' },
        { status: 400 },
      );
    }
    if (lastName !== undefined && lastName !== null &&
        (typeof lastName !== 'string' || !isValidName(lastName, NAME_MAX_LAST))) {
      return NextResponse.json(
        { error: 'Фамилия: только кириллица, минимум 2 символа' },
        { status: 400 },
      );
    }

    let normalizedProfile = null;
    if (profile) {
      const { calculateAgeData, isValidBirthDate } = await import('@/lib/age-utils');

      // Игровой номер: пусто или 1..99. Не используем truthiness — иначе
      // числовой 0 тихо стал бы null вместо явного отказа.
      const rawNumber = profile.number;
      const parsedNumber =
        rawNumber === null || rawNumber === undefined || rawNumber === ''
          ? null
          : parseInt(String(rawNumber), 10);
      if (!isValidGameNumber(parsedNumber)) {
        return NextResponse.json(
          { error: 'Игровой номер должен быть от 1 до 99' },
          { status: 400 },
        );
      }

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
        number: parsedNumber,
        birthDate: profile.birthDate ? new Date(profile.birthDate) : null,
        ageGroup,
        height: profile.height ? clampHeight(parseInt(profile.height)) : null,
        weight: profile.weight ? clampWeight(parseInt(profile.weight)) : null,
        avatarUrl: profile.avatarUrl ? profile.avatarUrl : null,
        clubLogoUrl: profile.clubLogoUrl ? profile.clubLogoUrl : null,
      };
    }

    // Если email передан, проверяем, что он не занят другим пользователем
    if (email) {
      const existing = await prisma.user.findFirst({
        where: { email, NOT: { id: userId } },
      });
      if (existing) {
        if (existing.telegramId.startsWith('email_')) {
          await prisma.user.delete({ where: { id: existing.id } });
        } else {
          return NextResponse.json(
            { error: 'Этот email уже используется другим аккаунтом' },
            { status: 409 },
          );
        }
      }
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        firstName,
        lastName,
        username,
        ...(email ? { email, emailVerified: true } : {}),
        profile: normalizedProfile
          ? {
              upsert: {
                create: normalizedProfile,
                update: normalizedProfile,
              },
            }
          : undefined,
      },
      include: { profile: true },
    });

    return NextResponse.json({ user });
  } catch (error: any) {
    console.error('Error in POST /api/profile:', error);

    if (error?.code === 'P2002') {
      return NextResponse.json(
        { error: 'Data conflict: user already exists with different parameters' },
        { status: 409 },
      );
    }

    if (error?.code === 'P2025') {
      return NextResponse.json({ error: 'Required record not found' }, { status: 404 });
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
