import { NextRequest, NextResponse } from 'next/server';
import { requireActiveSubscription } from '@/lib/coach/guards';
import { parseDateString } from '@/lib/age-utils';
import { generateMicrocycleForUser } from '@/lib/microcycle/generate';
import { getMicrocycleStartDate } from '@/lib/microcycle/week-start';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const auth = await requireActiveSubscription(request);
  if ('response' in auth) return auth.response;

  const body = await request.json().catch(() => null);
  if (body?.rebuildId !== undefined && (typeof body.rebuildId !== 'string' || !body.rebuildId)) {
    return NextResponse.json({ error: 'Укажите микроцикл для пересборки.' }, { status: 400 });
  }
  const today = getMicrocycleStartDate(new Date());
  const local = typeof body?.localDate === 'string' && parseDateString(body.localDate);
  const localDate = local && new Date(Date.UTC(local.year, local.month - 1, local.day));
  const startDate = localDate && Math.abs(localDate.getTime() - today.getTime()) <= 2 * 86_400_000
    ? localDate : today;
  const result = await generateMicrocycleForUser(auth.user.id, { startDate, rebuildId: body?.rebuildId });
  switch (result.status) {
    case 'NO_PROFILE':
      return NextResponse.json({ error: 'Профиль не найден. Пройдите онбординг.', redirectTo: '/onboarding/characteristics' }, { status: 404 });
    case 'AGE_REQUIRED':
      return NextResponse.json({ error: 'Укажите дату рождения в профиле, чтобы собрать план для своего возраста.' }, { status: 422 });
    case 'NO_MATCHING_VIDEOS':
      return NextResponse.json({ error: 'Пока нет подходящих видео для этой недели и вашего возраста.' }, { status: 422 });
    case 'STALE_REBUILD':
      return NextResponse.json({ error: 'План уже изменился. Обновите календарь.' }, { status: 409 });
    default:
      return NextResponse.json(result, { status: result.status === 'CREATED' ? 201 : 200 });
  }
}
