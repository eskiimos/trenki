import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { updateUserActivity } from '@/lib/updateUserActivity';
import { getSessionUserId } from '@/lib/auth-server';

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

    await updateUserActivity(user!.telegramId);

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

    let normalizedProfile = null;
    if (profile) {
      const { calculateAgeData, isValidBirthDate } = await import('@/lib/age-utils');

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
