/**
 * PATCH /api/profile/microcycle-preferences
 *
 * Legacy preference: automatic generation is disabled. Older clients may
 * still clear the setting, but cannot enable it again.
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

  if (body.autoGenerate) {
    return NextResponse.json(
      { error: 'Цикл собирается только по нажатию кнопки', code: 'MANUAL_GENERATION_ONLY' },
      { status: 409 },
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
    data: { autoGenerateMicrocycle: false },
    select: { autoGenerateMicrocycle: true },
  });

  return NextResponse.json(updated);
}
