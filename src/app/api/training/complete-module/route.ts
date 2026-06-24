import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  calculateWorkoutGains,
  calculatePotential,
  videoLoadTypes,
  CharacteristicType
} from '@/lib/characteristics';
import { markAssignmentsCompletedForVideos } from '@/lib/coach/auto-complete';
import { requireAuthUser } from '@/lib/coach/guards';

/**
 * POST /api/training/complete-module
 * Завершение модуля тренировки и обновление характеристик пользователя
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuthUser(request);
    if ('response' in auth) return auth.response;

    const body = await request.json();
    const { videoId, sessionId } = body;

    if (!videoId) {
      return NextResponse.json(
        { error: 'videoId обязателен' },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: auth.user.id },
      include: { profile: true },
    });

    if (!user || !user.profile) {
      return NextResponse.json(
        { error: 'Профиль не найден. Пройдите стартовый опрос.' },
        { status: 404 }
      );
    }

    // Находим видео с тегами
    const video = await prisma.video.findUnique({
      where: { id: videoId },
      include: {
        videoTags: {
          include: {
            tag: true,
          },
        },
      },
    });

    if (!video) {
      return NextResponse.json(
        { error: 'Видео не найдено' },
        { status: 404 }
      );
    }

    // Типы нагрузки: video.loadType (enum, источник истины) с фолбэком на
    // LOAD-теги. Раньше читались только теги → у видео без тега прирост был 0.
    const loadTypeTags = videoLoadTypes(video);

    console.log('🎯 Module completed:', {
      videoTitle: video.title,
      loadTypeTags,
    });

    // Текущие характеристики
    const currentCharacteristics: Record<CharacteristicType, number> = {
      ratingPower: user.profile.ratingPower,
      ratingSpeed: user.profile.ratingSpeed,
      ratingEndurance: user.profile.ratingEndurance,
      ratingTechnique: user.profile.ratingTechnique,
      ratingFlexibility: user.profile.ratingFlexibility,
    };

    // Флаг разминки/заминки — дают x0.5 поинтов
    const isWarmupOrCooldown = video.moduleType === 'WARMUP' || video.moduleType === 'COOLDOWN';

    // Рассчитываем прирост за один модуль
    const gains = calculateWorkoutGains(
      [loadTypeTags], // массив массивов тегов (один модуль)
      currentCharacteristics,
      [isWarmupOrCooldown]
    );

    console.log('📈 Calculated gains:', gains);

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

    // Проверяем лимит модулей в день
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const lastTrainingDate = user.profile.lastTrainingDate 
      ? new Date(user.profile.lastTrainingDate) 
      : null;
    
    let modulesToday = user.profile.modulesToday;
    
    // Сбрасываем счетчик если новый день
    if (!lastTrainingDate || lastTrainingDate < today) {
      modulesToday = 0;
    }

    // Проверяем лимит (4 модуля в день)
    if (modulesToday >= 4) {
      return NextResponse.json({
        success: false,
        error: 'Достигнут дневной лимит модулей (4). Отдохни и возвращайся завтра! 💪',
        limitReached: true,
      });
    }

    // Обновляем профиль
    const updatedProfile = await prisma.profile.update({
      where: { id: user.profile.id },
      data: {
        ratingPower: parseFloat(newCharacteristics.ratingPower.toFixed(1)),
        ratingSpeed: parseFloat(newCharacteristics.ratingSpeed.toFixed(1)),
        ratingEndurance: parseFloat(newCharacteristics.ratingEndurance.toFixed(1)),
        ratingTechnique: parseFloat(newCharacteristics.ratingTechnique.toFixed(1)),
        ratingFlexibility: parseFloat(newCharacteristics.ratingFlexibility.toFixed(1)),
        potential: newPotential,
        modulesToday: modulesToday + 1,
        lastTrainingDate: new Date(),
      },
    });

    console.log('✅ Profile updated:', {
      userId: user.id,
      newPotential,
      modulesToday: modulesToday + 1,
    });

    // Создаем запись в истории характеристик (для отображения прогресса)
    await prisma.characteristicHistory.create({
      data: {
        userId: user.id,
        sessionId: sessionId || null,
        
        // Новые значения после прироста
        ratingPower: parseFloat(newCharacteristics.ratingPower.toFixed(1)),
        ratingSpeed: parseFloat(newCharacteristics.ratingSpeed.toFixed(1)),
        ratingEndurance: parseFloat(newCharacteristics.ratingEndurance.toFixed(1)),
        ratingTechnique: parseFloat(newCharacteristics.ratingTechnique.toFixed(1)),
        ratingFlexibility: parseFloat(newCharacteristics.ratingFlexibility.toFixed(1)),
        potential: newPotential,
        
        // Прирост за этот модуль
        gainPower: gains.ratingPower,
        gainSpeed: gains.ratingSpeed,
        gainEndurance: gains.ratingEndurance,
        gainTechnique: gains.ratingTechnique,
        gainFlexibility: gains.ratingFlexibility,
        
        eventType: 'MODULE',
      },
    });

    console.log('✅ History entry created for module completion');

    // Если есть sessionId, отмечаем видео как завершенное
    if (sessionId) {
      await prisma.workoutSessionVideo.updateMany({
        where: {
          sessionId,
          videoId,
        },
        data: {
          completed: true,
          completedAt: new Date(),
        },
      });
    }

    // Автозакрытие тренерских заданий по этому видео
    if (videoId) {
      markAssignmentsCompletedForVideos(user.id, [videoId]).catch((e) => {
        console.error('auto-complete assignments error:', e);
      });
    }

    return NextResponse.json({
      success: true,
      gains,
      newCharacteristics: {
        ratingPower: updatedProfile.ratingPower,
        ratingSpeed: updatedProfile.ratingSpeed,
        ratingEndurance: updatedProfile.ratingEndurance,
        ratingTechnique: updatedProfile.ratingTechnique,
        ratingFlexibility: updatedProfile.ratingFlexibility,
        potential: updatedProfile.potential,
      },
      modulesToday: updatedProfile.modulesToday,
    });
  } catch (error) {
    console.error('Error completing module:', error);
    return NextResponse.json(
      { error: 'Ошибка сервера' },
      { status: 500 }
    );
  }
}
