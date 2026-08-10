import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { WorkoutStatus } from '@/generated/prisma';
import {
  calculateWorkoutGains,
  calculatePotential,
  videoLoadTypes,
  CharacteristicType
} from '@/lib/characteristics';
import { markAssignmentsCompletedForVideos } from '@/lib/coach/auto-complete';
import { requireAuthUser } from '@/lib/coach/guards';
import { tempoMultiplierToday, XP_PER_COMPLETED_WORKOUT, XP_PER_COMPLETED_MODULE } from '@/lib/gamification';

/**
 * POST /api/training/complete
 * Завершает тренировку, обновляет статус и рассчитывает прогресс за всю тренировку
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuthUser(request);
    if ('response' in auth) return auth.response;

    const body = await request.json();
    const { sessionId } = body;

    if (!sessionId) {
      return NextResponse.json(
        { error: 'sessionId обязателен' },
        { status: 400 }
      );
    }

    const session = await prisma.workoutSession.findUnique({
      where: { id: sessionId },
      include: {
        microcycleDay: true, // непустой → это тренировка из недельного цикла
        videos: {
          include: {
            video: {
              include: {
                videoTags: { include: { tag: true } },
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

    if (session.userId !== auth.user.id) {
      return NextResponse.json(
        { error: 'Доступ запрещен' },
        { status: 403 }
      );
    }

    // Идемпотентность: уже завершённую сессию повторно НЕ начисляем. Важно
    // особенно для цикловых — у них больше нет дневного лимита-бэкстопа, и
    // двойной вызов (ретрай/дабл-тап) иначе начислил бы прибавку дважды.
    if (session.status === WorkoutStatus.COMPLETED) {
      return NextResponse.json({ success: true, alreadyCompleted: true });
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

    // Типы нагрузки по каждому видео. Берём video.loadType (enum — источник
    // истины алгоритма) с фолбэком на LOAD-теги; раньше читались только теги,
    // и у видео без LOAD-тега прирост был 0 (баллы не начислялись).
    const moduleTags = session.videos.map(wsVideo => videoLoadTypes(wsVideo.video));

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

    // Тренировки из недельного цикла НЕ подпадают под дневной лимит (2/день) —
    // это запланированная программа, а не ad-hoc быстрые тренировки. Иначе при
    // «догоне» пропущенных дней цикла пользователь упирался в лимит и вместо
    // дашборда с прибавкой видел «достигнут дневной лимит» (баг C-6).
    const isCycleTraining = session.microcycleDay != null;

    // Проверяем лимит (2 тренировки в день) — только для быстрых тренировок.
    if (!isCycleTraining && trainingsToday >= 2) {
      return NextResponse.json({
        success: false,
        error: 'Достигнут дневной лимит тренировок (2). Отдохни и возвращайся завтра! 💪',
        limitReached: true,
      });
    }

    // Новое значение счётчика: цикловые тренировки его НЕ увеличивают
    // (не расходуют дневной бюджет быстрых тренировок).
    const newTrainingsToday = isCycleTraining ? trainingsToday : trainingsToday + 1;

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
        trainingsToday: newTrainingsToday,
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
      isCycleTraining,
      trainingsToday: newTrainingsToday,
    });

    // XP за эту тренировку: 100 (сессия) + 20×модули, всё ×множитель темпа
    // «на сегодня». Модули считаются только сейчас (XP берётся из COMPLETED-
    // сессий, а до этого статус был не COMPLETED) — поэтому здесь весь XP
    // тренировки приземляется разом. Считаем после установки COMPLETED, чтобы
    // сегодняшний день уже был «тренировочным» для множителя.
    const completedModuleCount = session.videos.filter((v) => v.completed).length;
    const workoutDates = await prisma.workoutSession.findMany({
      where: { userId: user.id, status: WorkoutStatus.COMPLETED, completedAt: { not: null } },
      select: { completedAt: true },
    });
    const tempoMultiplier = tempoMultiplierToday(workoutDates.map((w) => w.completedAt!));
    const xpEarned =
      (XP_PER_COMPLETED_WORKOUT + completedModuleCount * XP_PER_COMPLETED_MODULE) * tempoMultiplier;

    // Автозакрытие тренерских заданий:
    //   1. Полноценное 4-модульное задание привязано к этой WorkoutSession
    //      через TrainingAssignment.workoutSessionId — закрываем по sessionId.
    //   2. Старые одиночные задания (по videoId) — через
    //      markAssignmentsCompletedForVideos.
    (async () => {
      try {
        await prisma.trainingAssignment.updateMany({
          where: {
            workoutSessionId: sessionId,
            status: { in: ['PENDING', 'IN_PROGRESS'] },
          },
          data: { status: 'COMPLETED', completedAt: new Date() },
        });
      } catch (e) {
        console.error('auto-complete by workoutSessionId failed:', e);
      }
      try {
        const completedVideoIds = session.videos.map((v) => v.videoId);
        await markAssignmentsCompletedForVideos(auth.user.id, completedVideoIds);
      } catch (e) {
        console.error('auto-complete by videoId failed:', e);
      }
    })();

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
      xpEarned,
      tempoMultiplier,
      trainingsToday: newTrainingsToday,
    });

  } catch (error) {
    console.error('❌ Error completing workout:', error);
    return NextResponse.json(
      { error: 'Ошибка при завершении тренировки' },
      { status: 500 }
    );
  }
}
