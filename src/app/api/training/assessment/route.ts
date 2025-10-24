import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { LastTrainingTime, LoadDirection } from '@/generated/prisma';
import { ensureDevUser } from '@/lib/dev-user';

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
    
    // DEV MODE: автоматически создаём пользователя, если его нет
    await ensureDevUser(userId);

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

    // Алгоритм определения состояния (п.5 документа)
    
    // 1. Коэффициент свежести (на основе lastTrainingTime)
    let freshnessCoefficient = 1;
    switch (lastTrainingTime) {
      case 'TODAY':
        freshnessCoefficient = 1;
        break;
      case 'YESTERDAY':
        freshnessCoefficient = 2;
        break;
      case 'TWO_DAYS_AGO':
      case 'THREE_PLUS_DAYS':
        freshnessCoefficient = 3;
        break;
      case 'WEEK_PLUS':
        freshnessCoefficient = 1;
        break;
    }

    // 2. Уровень готовности = Коэффициент свежести + Energy
    const readinessLevel = freshnessCoefficient + energyLevel;

    // 3. Определяем статус и направление нагрузки
    let loadDirection: LoadDirection;
    let recommendedRPE: number;
    let trainingStatus: 'RECOVERY' | 'DEVELOPMENT' | 'PEAK';

    if (readinessLevel >= 2 && readinessLevel <= 6) {
      // Статус: Восстановление
      trainingStatus = 'RECOVERY';
      loadDirection = LoadDirection.LIGHT;
      recommendedRPE = Math.min(4, Math.max(2, readinessLevel - 1));
    } else if (readinessLevel >= 7 && readinessLevel <= 10) {
      // Статус: Развитие
      trainingStatus = 'DEVELOPMENT';
      loadDirection = LoadDirection.MEDIUM;
      recommendedRPE = Math.min(7, Math.max(5, readinessLevel - 2));
    } else {
      // Статус: Пик (11-13)
      trainingStatus = 'PEAK';
      loadDirection = LoadDirection.HIGH;
      recommendedRPE = Math.min(10, Math.max(8, readinessLevel - 3));
    }

    console.log('📊 Assessment calculation:', {
      freshnessCoefficient,
      energyLevel,
      readinessLevel,
      trainingStatus,
      loadDirection,
      recommendedRPE,
    });

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
        trainingStatus,
        readinessLevel,
        message: getRecommendationMessage(loadDirection, recommendedRPE, trainingStatus),
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
function getRecommendationMessage(
  loadDirection: LoadDirection, 
  rpe: number, 
  trainingStatus?: 'RECOVERY' | 'DEVELOPMENT' | 'PEAK'
): string {
  const statusMessages = {
    'RECOVERY': 'Статус: Восстановление. ',
    'DEVELOPMENT': 'Статус: Развитие. ',
    'PEAK': 'Статус: Пик формы. ',
  };

  const loadMessages = {
    [LoadDirection.LIGHT]: `Легкая тренировка (RPE ${rpe}/10). Фокус на восстановлении и технике.`,
    [LoadDirection.MEDIUM]: `Средняя тренировка (RPE ${rpe}/10). Сбалансированная нагрузка для развития.`,
    [LoadDirection.HIGH]: `Интенсивная тренировка (RPE ${rpe}/10). Высокая нагрузка для максимального прогресса.`,
  };

  const statusText = trainingStatus ? statusMessages[trainingStatus] : '';
  return statusText + (loadMessages[loadDirection] || 'Тренировка подобрана под ваше состояние.');
}
