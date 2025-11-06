import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// Коэффициенты для расчета k_mastery
const COEFFICIENTS = {
  yearsInHockey: {
    'LESS_THAN_1': 1.53,
    '1_TO_3': 1.65,
    '3_TO_5': 1.7,
    'MORE_THAN_5': 1.75,
  },
  trainingFrequency: {
    'ONCE_A_WEEK': 1.53,
    '2_TO_4_TIMES': 1.65,
    'ALMOST_DAILY': 1.7,
    'SEVERAL_TIMES_DAILY': 1.75,
  },
  matchFrequency: {
    'NO_MATCHES': 1.53,
    'FEW_PER_MONTH': 1.65,
    'ONCE_A_WEEK': 1.7,
    'SEVERAL_PER_WEEK': 1.75,
  },
  gameDifficulty: {
    'VERY_HARD': 1.53,
    'HARD': 1.64,
    'ADVANTAGE': 1.75,
  },
};

/**
 * POST /api/profile/characteristics
 * Сохранение стартовых характеристик пользователя
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      userId,
      rawPower,
      rawSpeed,
      rawEndurance,
      rawTechnique,
      rawFlexibility,
      yearsInHockey,
      trainingFrequency,
      matchFrequency,
      gameDifficulty,
    } = body;

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

    // Рассчитываем k_mastery (произведение 4 коэффициентов)
    const k1 = COEFFICIENTS.yearsInHockey[yearsInHockey as keyof typeof COEFFICIENTS.yearsInHockey] || 1.53;
    const k2 = COEFFICIENTS.trainingFrequency[trainingFrequency as keyof typeof COEFFICIENTS.trainingFrequency] || 1.53;
    const k3 = COEFFICIENTS.matchFrequency[matchFrequency as keyof typeof COEFFICIENTS.matchFrequency] || 1.53;
    const k4 = COEFFICIENTS.gameDifficulty[gameDifficulty as keyof typeof COEFFICIENTS.gameDifficulty] || 1.53;
    
    const kMastery = k1 * k2 * k3 * k4;

    // Рассчитываем rating для каждой характеристики
    // rating = raw * k_mastery
    let ratingPower = rawPower * kMastery;
    let ratingSpeed = rawSpeed * kMastery;
    let ratingEndurance = rawEndurance * kMastery;
    let ratingTechnique = rawTechnique * kMastery;
    let ratingFlexibility = rawFlexibility * kMastery;

    // Применяем ограничения: min 20, max 75 на старте
    ratingPower = Math.max(20, Math.min(75, ratingPower));
    ratingSpeed = Math.max(20, Math.min(75, ratingSpeed));
    ratingEndurance = Math.max(20, Math.min(75, ratingEndurance));
    ratingTechnique = Math.max(20, Math.min(75, ratingTechnique));
    ratingFlexibility = Math.max(20, Math.min(75, ratingFlexibility));

    // Рассчитываем potential (среднее арифметическое)
    const potential = (
      ratingPower +
      ratingSpeed +
      ratingEndurance +
      ratingTechnique +
      ratingFlexibility
    ) / 5;

    // Обновляем или создаем профиль
    const profile = await prisma.profile.upsert({
      where: { userId: user.id },
      update: {
        // Новые характеристики
        ratingPower: parseFloat(ratingPower.toFixed(1)),
        ratingSpeed: parseFloat(ratingSpeed.toFixed(1)),
        ratingEndurance: parseFloat(ratingEndurance.toFixed(1)),
        ratingTechnique: parseFloat(ratingTechnique.toFixed(1)),
        ratingFlexibility: parseFloat(ratingFlexibility.toFixed(1)),
        potential: parseFloat(potential.toFixed(1)),
        
        // Исходные данные
        rawPower,
        rawSpeed,
        rawEndurance,
        rawTechnique,
        rawFlexibility,
        kMastery: parseFloat(kMastery.toFixed(2)),
      },
      create: {
        userId: user.id,
        // Новые характеристики
        ratingPower: parseFloat(ratingPower.toFixed(1)),
        ratingSpeed: parseFloat(ratingSpeed.toFixed(1)),
        ratingEndurance: parseFloat(ratingEndurance.toFixed(1)),
        ratingTechnique: parseFloat(ratingTechnique.toFixed(1)),
        ratingFlexibility: parseFloat(ratingFlexibility.toFixed(1)),
        potential: parseFloat(potential.toFixed(1)),
        
        // Исходные данные
        rawPower,
        rawSpeed,
        rawEndurance,
        rawTechnique,
        rawFlexibility,
        kMastery: parseFloat(kMastery.toFixed(2)),
      },
    });

    console.log('✅ Characteristics saved:', {
      userId,
      kMastery: kMastery.toFixed(2),
      potential: potential.toFixed(1),
    });

    return NextResponse.json({
      success: true,
      profile: {
        ratingPower: profile.ratingPower,
        ratingSpeed: profile.ratingSpeed,
        ratingEndurance: profile.ratingEndurance,
        ratingTechnique: profile.ratingTechnique,
        ratingFlexibility: profile.ratingFlexibility,
        potential: profile.potential,
        kMastery: profile.kMastery,
      },
    });
  } catch (error) {
    console.error('Error saving characteristics:', error);
    return NextResponse.json(
      { error: 'Ошибка сервера' },
      { status: 500 }
    );
  }
}
