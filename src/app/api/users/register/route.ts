import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSessionUserId } from '@/lib/auth-server';
import { sanitizeName, isValidName, NAME_MAX_FIRST, NAME_MAX_LAST } from '@/lib/profile-validation';

export async function POST(request: NextRequest) {
  try {
    const userId = await getSessionUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { firstName, lastName, birthDate, gender, ageConsentAt } = body;

    if (!firstName || !lastName || !birthDate || !gender) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
    }

    // Имя/фамилия — только кириллица, минимум 2 буквы (нельзя доверять телу запроса).
    const fName = sanitizeName(String(firstName), NAME_MAX_FIRST);
    const lName = sanitizeName(String(lastName), NAME_MAX_LAST);
    if (!isValidName(fName, NAME_MAX_FIRST) || !isValidName(lName, NAME_MAX_LAST)) {
      return NextResponse.json(
        { error: 'Имя и фамилия — только кириллица, минимум 2 символа' },
        { status: 400 },
      );
    }

    const { calculateAgeData, isValidBirthDate } = await import('@/lib/age-utils');

    if (!isValidBirthDate(birthDate)) {
      return NextResponse.json({ error: 'Invalid birth date' }, { status: 400 });
    }

    const { ageGroup } = calculateAgeData(birthDate);

    let genderEnum: 'MALE' | 'FEMALE' | 'NOT_SPECIFIED';
    if (gender === 'male') genderEnum = 'MALE';
    else if (gender === 'female') genderEnum = 'FEMALE';
    else genderEnum = 'NOT_SPECIFIED';

    const profileData: any = {
      gender: genderEnum,
      birthDate: new Date(birthDate),
      ageGroup,
    };

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        firstName: fName,
        lastName: lName,
        ...(ageConsentAt ? { ageConsentAt: new Date(ageConsentAt) } : {}),
        profile: {
          upsert: {
            create: profileData,
            update: profileData,
          },
        },
      },
      include: { profile: true },
    });

    return NextResponse.json({ success: true, user });
  } catch (error) {
    console.error('Error registering user:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
