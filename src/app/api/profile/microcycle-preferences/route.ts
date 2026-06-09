/**
 * PATCH /api/profile/microcycle-preferences
 *
 * Атлет включает/выключает авто-генерацию микроциклов.
 *
 * Body: { autoGenerate: boolean }
 * Auth: httpOnly session cookie.
 *
 * Response 200: { autoGenerateMicrocycle: boolean }
 * Response 400: невалидный body
 * Response 404: профиль не найден
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuthUser } from '@/lib/coach/guards';

export const dynamic = 'force-dynamic';

export async function PATCH(request: NextRequest) {
  const auth = await requireAuthUser(request);
  if ('response' in auth) return auth.response;

  const body = await request.json().catch(() => ({}));
  if (typeof body?.autoGenerate !== 'boolean') {
    return NextResponse.json(
      { error: 'autoGenerate должен быть boolean' },
      { status: 400 },
    );
  }

  const profile = await prisma.profile.findUnique({
    where: { userId: auth.user.id },
    select: { id: true },
  });
  if (!profile) {
    return NextResponse.json({ error: 'Профиль не найден' }, { status: 404 });
  }

  const updated = await prisma.profile.update({
    where: { id: profile.id },
    data: { autoGenerateMicrocycle: body.autoGenerate },
    select: { autoGenerateMicrocycle: true },
  });

  return NextResponse.json(updated);
}
