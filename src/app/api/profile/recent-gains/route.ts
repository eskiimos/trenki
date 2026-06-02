import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuthUser } from '@/lib/coach/guards';

type HistoryEntry = {
  gainPower: number;
  gainSpeed: number;
  gainEndurance: number;
  gainTechnique: number;
  gainFlexibility: number;
};

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuthUser(request);
    if ('response' in auth) return auth.response;
    const userId = auth.user.id;

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '5', 10);

    // Получаем последние записи истории с приростом
    const recentHistory = await prisma.characteristicHistory.findMany({
      where: {
        userId,
        OR: [
          { gainPower: { not: 0 } },
          { gainSpeed: { not: 0 } },
          { gainEndurance: { not: 0 } },
          { gainTechnique: { not: 0 } },
          { gainFlexibility: { not: 0 } },
        ],
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    });

    // Суммируем приросты по каждой характеристике
    const totalGains = recentHistory.reduce(
      (acc: HistoryEntry, entry: HistoryEntry) => ({
        gainPower: acc.gainPower + entry.gainPower,
        gainSpeed: acc.gainSpeed + entry.gainSpeed,
        gainEndurance: acc.gainEndurance + entry.gainEndurance,
        gainTechnique: acc.gainTechnique + entry.gainTechnique,
        gainFlexibility: acc.gainFlexibility + entry.gainFlexibility,
      }),
      {
        gainPower: 0,
        gainSpeed: 0,
        gainEndurance: 0,
        gainTechnique: 0,
        gainFlexibility: 0,
      }
    );

    return NextResponse.json({
      success: true,
      recentHistory,
      totalGains,
    });
  } catch (error) {
    console.error('Ошибка получения истории прироста:', error);
    return NextResponse.json(
      { error: 'Ошибка сервера' },
      { status: 500 }
    );
  }
}
