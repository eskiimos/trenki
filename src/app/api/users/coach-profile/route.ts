import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuthUser } from '@/lib/coach/guards';

export const dynamic = 'force-dynamic';

/**
 * POST /api/users/coach-profile
 * Body: { firstName, lastName, clubName?, position?, experienceYears? }
 * Создаёт/обновляет профиль тренера. Также выставляет role=COACH.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuthUser(request);
  if ('response' in auth) return auth.response;

  const body = await request.json().catch(() => ({}));
  const firstName = String(body?.firstName || '').trim();
  const lastName = String(body?.lastName || '').trim();
  const clubName = body?.clubName ? String(body.clubName).trim() : null;
  const position = body?.position ? String(body.position).trim() : null;
  const experienceYears = body?.experienceYears != null
    ? Number(body.experienceYears)
    : null;

  if (!firstName || !lastName) {
    return NextResponse.json({ error: 'Имя и фамилия обязательны' }, { status: 400 });
  }
  if (experienceYears != null && (Number.isNaN(experienceYears) || experienceYears < 0 || experienceYears > 80)) {
    return NextResponse.json({ error: 'Некорректный стаж' }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: auth.user.id },
    data: {
      firstName,
      lastName,
      role: 'COACH',
      coachProfile: {
        upsert: {
          create: {
            clubName,
            position,
            experienceYears,
          },
          update: {
            clubName,
            position,
            experienceYears,
          },
        },
      },
    },
  });

  return NextResponse.json({ success: true });
}
