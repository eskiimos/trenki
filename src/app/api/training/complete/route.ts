import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { WorkoutStatus } from '@/generated/prisma';
import { 
  calculateWorkoutGains, 
  calculatePotential,
  CharacteristicType 
} from '@/lib/characteristics';
import { markAssignmentsCompletedForVideos } from '@/lib/coach/auto-complete';

/**
 * POST /api/training/complete
 * Завершает тренировку, обновляет статус и рассчитывает прогресс за всю тренировку
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, userId } = body;

    if (!sessionId || !userId) {
      return NextResponse.json(
        { error: 'sessionId и userId обязательны' },
        { status: 400 }
      );
    }

    // Проверяем, что все видео в тренировке завершены
    const session = await prisma.workoutSession.findUnique({
      where: { id: sessionId },
      include: {
        videos: {
          include: {
            video: {
              include: {
                videoTags: {
                  include: {
                    tag: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!session) {
      return NextResponse.json(
        { error: 'Тренировка не найдена' },
        { status: 404 }
      );
    }

    // Находим пользователя по telegramId или внутреннему id
    let requestUser = await prisma.user.findUnique({
      where: { telegramId: userId },
      select: { id: true },
    });

    if (!requestUser) {
      requestUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true },
      });
    }

    if (!requestUser || session.userId !== requestUser.id) {
      return NextResponse.json(
        { error: 'Доступ запрещен' },
        { status: 403 }
      );
    }

    const allCompleted = session.videos.every(v => v.completed);
    
    if (!allCompleted) {
      return NextResponse.json(
        { error: 'Не все видео завершены' },
        { status: 400 }
      );
    }

    // Находим пользователя с профилем
    const user = await prisma.user.findFirst({
      where: { id: session.userId },
      include: { profile: true },
    });

    if (!user || !user.profile) {
      return NextResponse.json(
        { error: 'Профиль пользователя не найден' },
        { status: 404 }
      );
    }

    // Собираем все теги LoadType из всех видео тренировки
    const moduleTags = session.videos.map(wsVideo => {
      return wsVideo.video.videoTags
        .filter(vt => vt.tag.tagType === 'LOAD' && vt.tag.loadType)
        .map(vt => vt.tag.loadType as string);
    });

    // Флаги разминки/заминки — дают x0.5 поинтов
    const isWarmupOrCooldown = session.videos.map(wsVideo => {
      const mt = wsVideo.video.moduleType;
      return mt === 'WARMUP' || mt === 'COOLDOWN';
    });

    console.log('🎯 Workout completed - calculating progress:', {
      sessionId,
      modulesCount: moduleTags.length,
      moduleTags,
      isWarmupOrCooldown,
    });

    // Текущие характеристики
    const currentCharacteristics: Record<CharacteristicType, number> = {
      ratingPower: user.profile.ratingPower,
      ratingSpeed: user.profile.ratingSpeed,
      ratingEndurance: user.profile.ratingEndurance,
      ratingTechnique: user.profile.ratingTechnique,
      ratingFlexibility: user.profile.ratingFlexibility,
    };

    // Рассчитываем прирост за всю тренировку
    const gains = calculateWorkoutGains(moduleTags, currentCharacteristics, isWarmupOrCooldown);

    console.log('📈 Total workout gains:', gains);

    // Обновляем характеристики
    const newCharacteristics: Record<CharacteristicType, number> = {
      ratingPower: currentCharacteristics.ratingPower + gains.ratingPower,
      ratingSpeed: currentCharacteristics.ratingSpeed + gains.ratingSpeed,
      ratingEndurance: currentCharacteristics.ratingEndurance + gains.ratingEndurance,
      ratingTechnique: currentCharacteristics.ratingTechnique + gains.ratingTechnique,
      ratingFlexibility: currentCharacteristics.ratingFlexibility + gains.ratingFlexibility,
    };

    // Ограничиваем максимум 100
    Object.keys(newCharacteristics).forEach(key => {
      const charKey = key as CharacteristicType;
      newCharacteristics[charKey] = Math.min(100, newCharacteristics[charKey]);
    });

    // Пересчитываем potential
    const newPotential = calculatePotential(newCharacteristics);

    // Проверяем лимит тренировок в день
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const lastTrainingDate = user.profile.lastTrainingDate 
      ? new Date(user.profile.lastTrainingDate) 
      : null;
    
    let trainingsToday = user.profile.trainingsToday;
    
    // Сбрасываем счетчик если новый день
    if (!lastTrainingDate || lastTrainingDate < today) {
      trainingsToday = 0;
    }

    // Проверяем лимит (2 тренировки в день)
    if (trainingsToday >= 2) {
      return NextResponse.json({
        success: false,
        error: 'Достигнут дневной лимит тренировок (2). Отдохни и возвращайся завтра! 💪',
        limitReached: true,
      });
    }

    // Обновляем профиль
    await prisma.profile.update({
      where: { id: user.profile.id },
      data: {
        ratingPower: parseFloat(newCharacteristics.ratingPower.toFixed(1)),
        ratingSpeed: parseFloat(newCharacteristics.ratingSpeed.toFixed(1)),
        ratingEndurance: parseFloat(newCharacteristics.ratingEndurance.toFixed(1)),
        ratingTechnique: parseFloat(newCharacteristics.ratingTechnique.toFixed(1)),
        ratingFlexibility: parseFloat(newCharacteristics.ratingFlexibility.toFixed(1)),
        potential: newPotential,
        trainingsToday: trainingsToday + 1,
        lastTrainingDate: new Date(),
      },
    });

    // Создаем запись в истории характеристик
    await prisma.characteristicHistory.create({
      data: {
        userId: user.id,
        sessionId: sessionId,
        
        // Новые значения после прироста
        ratingPower: parseFloat(newCharacteristics.ratingPower.toFixed(1)),
        ratingSpeed: parseFloat(newCharacteristics.ratingSpeed.toFixed(1)),
        ratingEndurance: parseFloat(newCharacteristics.ratingEndurance.toFixed(1)),
        ratingTechnique: parseFloat(newCharacteristics.ratingTechnique.toFixed(1)),
        ratingFlexibility: parseFloat(newCharacteristics.ratingFlexibility.toFixed(1)),
        potential: newPotential,
        
        // Прирост за всю тренировку
        gainPower: gains.ratingPower,
        gainSpeed: gains.ratingSpeed,
        gainEndurance: gains.ratingEndurance,
        gainTechnique: gains.ratingTechnique,
        gainFlexibility: gains.ratingFlexibility,
        
        eventType: 'WORKOUT',
      },
    });

    console.log('✅ History entry created for workout completion');

    // Обновляем статус тренировки на COMPLETED
    const updatedSession = await prisma.workoutSession.update({
      where: { id: sessionId },
      data: {
        status: WorkoutStatus.COMPLETED,
        completedAt: new Date(),
      },
    });

    console.log('✅ Workout completed:', {
      sessionId: updatedSession.id,
      status: updatedSession.status,
      newPotential,
      trainingsToday: trainingsToday + 1,
    });

    // Автозакрытие тренерских заданий по этим видео
    const completedVideoIds = session.videos.map((v) => v.videoId);
    markAssignmentsCompletedForVideos(userId, completedVideoIds).catch((e) => {
      console.error('auto-complete assignments error:', e);
    });

    return NextResponse.json({
      success: true,
      message: 'Тренировка успешно завершена!',
      workout: updatedSession,
      gains,
      newCharacteristics: {
        ratingPower: newCharacteristics.ratingPower,
        ratingSpeed: newCharacteristics.ratingSpeed,
        ratingEndurance: newCharacteristics.ratingEndurance,
        ratingTechnique: newCharacteristics.ratingTechnique,
        ratingFlexibility: newCharacteristics.ratingFlexibility,
        potential: newPotential,
      },
      trainingsToday: trainingsToday + 1,
    });

  } catch (error) {
    console.error('❌ Error completing workout:', error);
    return NextResponse.json(
      { error: 'Ошибка при завершении тренировки' },
      { status: 500 }
    );
  }
}
