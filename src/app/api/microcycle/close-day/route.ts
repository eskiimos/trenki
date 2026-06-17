/**
 * POST /api/microcycle/close-day
 *
 * C-4: «засчитать быструю в цикл». Когда у спортсмена активен цикл, но он вместо
 * цикловой делает быструю тренировку — закрываем день цикла, помечая его сессию
 * COMPLETED. Характеристики НЕ начисляем (их даёт сама быстрая тренировка) — тут
 * только статус, чтобы день считался выполненным и не напоминался (C-5/C-7).
 *
 * Работает только для сессий, привязанных к дню цикла (microcycleDay != null).
 * Body: { sessionId }
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuthUser } from '@/lib/coach/guards';
import { WorkoutStatus } from '@/generated/prisma';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuthUser(request);
    if ('response' in auth) return auth.response;

    const { sessionId } = await request.json();
    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId обязателен' }, { status: 400 });
    }

    const session = await prisma.workoutSession.findUnique({
      where: { id: sessionId },
      include: { microcycleDay: true },
    });

    if (!session) {
      return NextResponse.json({ error: 'Сессия не найдена' }, { status: 404 });
    }
    if (session.userId !== auth.user.id) {
      return NextResponse.json({ error: 'Доступ запрещён' }, { status: 403 });
    }
    if (!session.microcycleDay) {
      // Защита: закрывать так можно только цикловые дни, не произвольные сессии.
      return NextResponse.json({ error: 'Сессия не относится к циклу' }, { status: 400 });
    }

    // Идемпотентно: уже закрытую сессию повторно не трогаем.
    if (session.status === WorkoutStatus.COMPLETED || session.status === WorkoutStatus.SKIPPED) {
      return NextResponse.json({ success: true, alreadyClosed: true });
    }

    await prisma.workoutSession.update({
      where: { id: sessionId },
      data: { status: WorkoutStatus.COMPLETED, completedAt: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Ошибка close-day:', error);
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 });
  }
}
