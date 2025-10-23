import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { LastTrainingTime, LoadDirection } from '@/generated/prisma';

/**
 * POST /api/training/assessment
 * Создает новую оценку состояния пользователя и определяет параметры тренировки
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      userId,
      lastTrainingTime,
      energyLevel,
      muscleReadiness,
      motivation,
      availableTime,
    } = body;

    // Валидация входных данных
    if (!userId) {
      return NextResponse.json(
        { error: 'userId обязателен' },
        { status: 400 }
      );
    }

    if (!lastTrainingTime || !LastTrainingTime[lastTrainingTime as keyof typeof LastTrainingTime]) {
      return NextResponse.json(
        { error: 'Некорректное значение lastTrainingTime' },
        { status: 400 }
      );
    }

    if (
      energyLevel < 1 || energyLevel > 10 ||
      muscleReadiness < 1 || muscleReadiness > 10 ||
      motivation < 1 || motivation > 10
    ) {
      return NextResponse.json(
        { error: 'Значения энергии, готовности и мотивации должны быть от 1 до 10' },
        { status: 400 }
      );
    }

    if (!availableTime || availableTime < 5) {
      return NextResponse.json(
        { error: 'Доступное время должно быть минимум 5 минут' },
        { status: 400 }
      );
    }

    // Алгоритм определения направления нагрузки (п.3)
    const avgScore = (energyLevel + muscleReadiness + motivation) / 3;
    
    let loadDirection: LoadDirection;
    let recommendedRPE: number;

    if (lastTrainingTime === 'TODAY' || lastTrainingTime === 'YESTERDAY') {
      // Недавно тренировался - легкая нагрузка
      loadDirection = LoadDirection.LIGHT;
      recommendedRPE = Math.min(4, Math.round(avgScore * 0.4));
    } else if (avgScore >= 8) {
      // Высокая энергия и готовность - высокая нагрузка
      loadDirection = LoadDirection.HIGH;
      recommendedRPE = Math.max(8, Math.round(avgScore * 1.0));
    } else if (avgScore >= 5) {
      // Средняя готовность - средняя нагрузка
      loadDirection = LoadDirection.MEDIUM;
      recommendedRPE = Math.round(avgScore * 0.7);
    } else {
      // Низкая энергия - легкая нагрузка
      loadDirection = LoadDirection.LIGHT;
      recommendedRPE = Math.min(4, Math.round(avgScore * 0.4));
    }

    // Создаем оценку состояния
    const assessment = await prisma.userStateAssessment.create({
      data: {
        userId,
        lastTrainingTime: lastTrainingTime as LastTrainingTime,
        energyLevel,
        muscleReadiness,
        motivation,
        availableTime,
        loadDirection,
        recommendedRPE,
      },
    });

    return NextResponse.json({
      success: true,
      assessment,
      recommendation: {
        loadDirection,
        recommendedRPE,
        message: getRecommendationMessage(loadDirection, recommendedRPE),
      },
    });
  } catch (error) {
    console.error('Ошибка создания оценки:', error);
    return NextResponse.json(
      { error: 'Ошибка сервера' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/training/assessment?userId=xxx
 * Получает последнюю оценку состояния пользователя
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'userId обязателен' },
        { status: 400 }
      );
    }

    // Получаем последнюю оценку
    const assessment = await prisma.userStateAssessment.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    if (!assessment) {
      return NextResponse.json(
        { error: 'Оценка не найдена' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      assessment,
      recommendation: {
        loadDirection: assessment.loadDirection,
        recommendedRPE: assessment.recommendedRPE,
        message: getRecommendationMessage(assessment.loadDirection, assessment.recommendedRPE),
      },
    });
  } catch (error) {
    console.error('Ошибка получения оценки:', error);
    return NextResponse.json(
      { error: 'Ошибка сервера' },
      { status: 500 }
    );
  }
}

// Вспомогательная функция для генерации сообщения
function getRecommendationMessage(loadDirection: LoadDirection, rpe: number): string {
  const messages = {
    [LoadDirection.LIGHT]: `Легкая тренировка (RPE ${rpe}/10). Фокус на восстановлении и технике.`,
    [LoadDirection.MEDIUM]: `Средняя тренировка (RPE ${rpe}/10). Сбалансированная нагрузка для развития.`,
    [LoadDirection.HIGH]: `Интенсивная тренировка (RPE ${rpe}/10). Высокая нагрузка для максимального прогресса.`,
  };

  return messages[loadDirection] || 'Тренировка подобрана под ваше состояние.';
}
