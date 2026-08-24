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
import { sendFirstWorkoutEmail } from '@/lib/email-campaigns';
import { logger } from '@/lib/logger';

/**
 * POST /api/training/complete
 * Завершает тренировку, обновляет статус и рассчитывает прогресс за всю тренировку
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuthUser(request);
    if ('response' in auth) return auth.response;

    const body = await request.json();
    const { sessionId, earlyFinish } = body;

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

    // C-4: эта быстрая — замена циклового дня; закрываем его по факту
    // выполненной работы (и полной, и досрочной PARTIAL). Идемпотентно
    // (статусный notIn) — поэтому зовётся и из ретрай-веток alreadyCompleted:
    // захват сессии и закрытие дня не атомарны, и обрыв между ними иначе
    // оставлял бы день цикла PENDING навсегда (быстрая уже COMPLETED, повторный
    // вызов уходил в ранний return до закрытия).
    const closeLinkedCycleDay = async (finishedAt: Date) => {
      if (!session.closesCycleSessionId) return;
      try {
        await prisma.workoutSession.updateMany({
          where: {
            id: session.closesCycleSessionId,
            userId: session.userId,
            status: { notIn: [WorkoutStatus.COMPLETED, WorkoutStatus.PARTIAL] },
          },
          data: { status: WorkoutStatus.COMPLETED, completedAt: finishedAt },
        });
      } catch (e) {
        console.error('close linked cycle day failed:', e);
      }
    };

    // Идемпотентность: уже начисленную сессию (полную COMPLETED или досрочную
    // PARTIAL) повторно НЕ начисляем. Важно особенно для цикловых — у них больше
    // нет дневного лимита-бэкстопа, и двойной вызов (ретрай/дабл-тап) иначе
    // начислил бы прибавку дважды.
    if (session.status === WorkoutStatus.COMPLETED || session.status === WorkoutStatus.PARTIAL) {
      await closeLinkedCycleDay(session.completedAt ?? new Date());
      return NextResponse.json({ success: true, alreadyCompleted: true });
    }

    // Досрочный финиш (earlyFinish): засчитываем только пройденные модули, без
    // бонуса за полную тренировку. Обычный финиш требует, чтобы были пройдены все.
    const completedVideos = session.videos.filter(v => v.completed);
    const allCompleted = session.videos.length > 0 && completedVideos.length === session.videos.length;
    const isPartial = !!earlyFinish && !allCompleted;

    if (!earlyFinish && !allCompleted) {
      return NextResponse.json(
        { error: 'Не все видео завершены' },
        { status: 400 }
      );
    }
    if (earlyFinish && completedVideos.length === 0) {
      return NextResponse.json(
        { error: 'Пройди хотя бы один модуль, чтобы засчитать тренировку' },
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
    // Прирост считаем ТОЛЬКО по реально пройденным (completed) модулям: при
    // досрочном финише непройденные не должны давать характеристики (иначе это
    // эксплойт). При полном финише completedVideos == все модули сессии.
    const moduleTags = completedVideos.map(wsVideo => videoLoadTypes(wsVideo.video));

    // Флаги разминки/заминки — дают x0.5 поинтов
    const isWarmupOrCooldown = completedVideos.map(wsVideo => {
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

    // Атомарный «захват» сессии: ровно один запрос переведёт её из не-финального
    // статуса в финальный (COMPLETED или досрочный PARTIAL) и начислит прибавку.
    // Защита от двойного начисления при ретрае/дабл-тапе — начисляем ниже ТОЛЬКО
    // если захват удался (count === 1).
    const finishedAt = new Date();
    const targetStatus = isPartial ? WorkoutStatus.PARTIAL : WorkoutStatus.COMPLETED;
    const captured = await prisma.workoutSession.updateMany({
      where: {
        id: sessionId,
        status: { notIn: [WorkoutStatus.COMPLETED, WorkoutStatus.PARTIAL] },
      },
      data: { status: targetStatus, completedAt: finishedAt },
    });
    if (captured.count === 0) {
      await closeLinkedCycleDay(new Date());
      return NextResponse.json({ success: true, alreadyCompleted: true });
    }

    // C-4: замена циклового дня → закрываем день СЕЙЧАС, по факту выполненной
    // работы. Раньше клиент закрывал день при СОЗДАНИИ замены, и дни числились
    // выполненными без единой тренировки.
    await closeLinkedCycleDay(finishedAt);

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
        lastTrainingDate: finishedAt,
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

    // Статус уже установлен атомарным захватом выше (COMPLETED или PARTIAL).
    console.log('✅ Workout finished:', {
      sessionId,
      status: targetStatus,
      isPartial,
      newPotential,
      isCycleTraining,
      trainingsToday: newTrainingsToday,
    });

    // XP за эту тренировку. Полная: 100 (бонус) + 20×модули. Досрочная (PARTIAL):
    // только 20×пройденные модули, без бонуса +100 — его и «недозарабатываешь».
    // Всё ×множитель «Темпа ×2» на сегодня. Модуль-XP приземляется здесь разом
    // (до этого статус был не финальным, ретроспектива их не считала). Множитель
    // считаем после захвата, чтобы сегодняшний день уже был «тренировочным».
    const completedModuleCount = completedVideos.length;
    const trainingDates = await prisma.workoutSession.findMany({
      where: {
        userId: user.id,
        status: { in: [WorkoutStatus.COMPLETED, WorkoutStatus.PARTIAL] },
        completedAt: { not: null },
      },
      select: { completedAt: true },
    });
    const tempoMultiplier = tempoMultiplierToday(
      trainingDates.map((w) => w.completedAt!),
      new Date(),
      user.timezone || 'Europe/Moscow',
    );
    const workoutBonus = isPartial ? 0 : XP_PER_COMPLETED_WORKOUT;
    const xpEarned =
      (workoutBonus + completedModuleCount * XP_PER_COMPLETED_MODULE) * tempoMultiplier;

    // Автозакрытие тренерских заданий — ТОЛЬКО при полном завершении. Досрочный
    // финиш (PARTIAL) не считается выполненным заданием тренера.
    //   1. Полноценное 4-модульное задание привязано к этой WorkoutSession
    //      через TrainingAssignment.workoutSessionId — закрываем по sessionId.
    //   2. Старые одиночные задания (по videoId) — через
    //      markAssignmentsCompletedForVideos.
    if (!isPartial) {
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
    }

    // FIRST_WORKOUT-письмо: только после ПЕРВОЙ полной (COMPLETED) тренировки.
    // Fire-and-forget — НЕ блокируем ответ роута (как auto-complete выше).
    // sendFirstWorkoutEmail сам держит килл-свитч (canSendCampaign). completedCount
    // считаем после атомарного захвата (эта сессия уже COMPLETED) — первая ⇔ === 1.
    // Дедуп firstWorkoutEmailSentAt ставим только при реальной отправке.
    if (targetStatus === WorkoutStatus.COMPLETED && user.firstWorkoutEmailSentAt == null) {
      const u = user;
      void (async () => {
        try {
          const completedCount = await prisma.workoutSession.count({
            where: { userId: u.id, status: WorkoutStatus.COMPLETED },
          });
          if (completedCount !== 1) return; // не первая полная — не шлём
          const ok = await sendFirstWorkoutEmail({ id: u.id, email: u.email, emailOptOut: u.emailOptOut });
          if (ok) {
            await prisma.user.update({
              where: { id: u.id },
              data: { firstWorkoutEmailSentAt: new Date() },
            });
          }
        } catch (e) {
          logger.error('first-workout email flow failed', { userId: u.id, err: String(e) });
        }
      })();
    }

    return NextResponse.json({
      success: true,
      message: isPartial ? 'Пройденные модули засчитаны!' : 'Тренировка успешно завершена!',
      partial: isPartial,
      workout: { id: sessionId, status: targetStatus, completedAt: finishedAt },
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
