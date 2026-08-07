// Лига (геймификация, Фаза 3): недельная таблица когорты по году рождения
// для родительского кабинета. Приватность: в ответе НЕТ userId других детей
// и НЕТ полных фамилий — чужие как «Имя Ф.», свой ребёнок — по имени.
// Сборка лиги (БД-запросы) — в '@/lib/league-server', чистая логика —
// в '@/lib/league' (тестируется без БД). Здесь только auth + проверка связи.

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuthUser } from '@/lib/coach/guards';
import { buildLeagueForUser } from '@/lib/league-server';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await requireAuthUser(request);
  if ('response' in auth) return auth.response;
  const parentId = auth.user.id;

  const childId = request.nextUrl.searchParams.get('childId');
  if (!childId) {
    return NextResponse.json({ error: 'childId обязателен' }, { status: 400 });
  }

  try {
    // Родитель видит лигу только своего ребёнка (ParentLink обязателен)
    const link = await prisma.parentLink.findUnique({
      where: { parentId_childId: { parentId, childId } },
      select: { id: true },
    });
    if (!link) {
      return NextResponse.json({ error: 'Нет доступа к этому ребёнку' }, { status: 403 });
    }

    return NextResponse.json(await buildLeagueForUser(childId));
  } catch (error) {
    logger.error('parent league fetch failed', error);
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 });
  }
}
