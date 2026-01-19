import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * POST /api/profile/reset-characteristics
 * Сброс характеристик пользователя (для тестирования)
 * ТОЛЬКО ДЛЯ РАЗРАБОТКИ
 */
export async function POST(request: NextRequest) {
  try {
    // Проверяем, что это не production
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        { error: 'Недоступно в production' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json(
        { error: 'userId обязателен' },
        { status: 400 }
      );
    }

    // Находим пользователя
    const user = await prisma.user.findUnique({
      where: { telegramId: userId },
      include: { profile: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Пользователь не найден' },
        { status: 404 }
      );
    }

    if (!user.profile) {
      return NextResponse.json(
        { error: 'Профиль не найден' },
        { status: 404 }
      );
    }

    // Сбрасываем все характеристики
    const profile = await prisma.profile.update({
      where: { userId: user.id },
      data: {
        ratingPower: 0,
        ratingSpeed: 0,
        ratingEndurance: 0,
        ratingTechnique: 0,
        ratingFlexibility: 0,
        potential: 0,
        rawPower: null,
        rawSpeed: null,
        rawEndurance: null,
        rawTechnique: null,
        rawFlexibility: null,
        kMastery: null,
      },
    });

    console.log('🔄 Характеристики сброшены для пользователя:', userId);

    return NextResponse.json({
      success: true,
      message: 'Характеристики успешно сброшены',
    });
  } catch (error) {
    console.error('Ошибка при сбросе характеристик:', error);
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    );
  }
}
