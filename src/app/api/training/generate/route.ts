import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { LoadDirection, WorkoutStatus, ModuleType } from '@/generated/prisma';

/**
 * POST /api/training/generate
 * Генерирует персональную тренировку на основе оценки состояния пользователя
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, assessmentId } = body;

    if (!userId) {
      return NextResponse.json(
        { error: 'userId обязателен' },
        { status: 400 }
      );
    }

    // Получаем последнюю оценку состояния
    let assessment;
    if (assessmentId) {
      assessment = await prisma.userStateAssessment.findUnique({
        where: { id: assessmentId },
      });
    } else {
      assessment = await prisma.userStateAssessment.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });
    }

    if (!assessment) {
      return NextResponse.json(
        { error: 'Оценка состояния не найдена. Сначала пройдите опрос.' },
        { status: 404 }
      );
    }

    // Получаем историю последних выполненных модулей (п.6 - предотвращение повторов)
    const recentHistory = await prisma.userModuleHistory.findMany({
      where: {
        userId,
        completedAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // последние 7 дней
        },
      },
      select: { moduleId: true },
    });

    const recentModuleIds = recentHistory.map((h) => h.moduleId);

    // Подбираем модули по алгоритму
    const selectedModules = await selectModulesForWorkout(
      assessment.loadDirection,
      assessment.recommendedRPE,
      assessment.availableTime,
      recentModuleIds
    );

    if (selectedModules.length === 0) {
      return NextResponse.json(
        { error: 'Не удалось подобрать подходящие модули для тренировки' },
        { status: 404 }
      );
    }

    // Создаем сессию тренировки
    const workout = await prisma.workoutSession.create({
      data: {
        userId,
        assessmentId: assessment.id,
        targetDuration: assessment.availableTime,
        targetRPE: assessment.recommendedRPE,
        loadDirection: assessment.loadDirection,
        status: WorkoutStatus.PENDING,
        modules: {
          create: selectedModules.map((module, index) => ({
            moduleId: module.id,
            order: index,
          })),
        },
      },
      include: {
        modules: {
          include: {
            module: {
              include: {
                video: true,
              },
            },
          },
          orderBy: { order: 'asc' },
        },
      },
    });

    // Рассчитываем общую длительность
    const totalDuration = selectedModules.reduce((sum, m) => sum + m.duration, 0);

    return NextResponse.json({
      success: true,
      workout: {
        id: workout.id,
        targetDuration: workout.targetDuration,
        actualDuration: Math.round(totalDuration / 60), // в минутах
        targetRPE: workout.targetRPE,
        loadDirection: workout.loadDirection,
        modulesCount: selectedModules.length,
        modules: workout.modules.map((wm) => ({
          id: wm.module.id,
          name: wm.module.name,
          description: wm.module.description,
          type: wm.module.type,
          duration: wm.module.duration,
          rpeRange: `${wm.module.rpeMin}-${wm.module.rpeMax}`,
          video: wm.module.video,
          order: wm.order,
        })),
      },
    });
  } catch (error) {
    console.error('Ошибка генерации тренировки:', error);
    return NextResponse.json(
      { error: 'Ошибка сервера' },
      { status: 500 }
    );
  }
}

/**
 * Подбор модулей для тренировки
 * Алгоритм по документу:
 * 1. Разминка (WARMUP) - 1 модуль
 * 2. Физическая подготовка (FITNESS) - 1 модуль (стержневой)
 * 3. Техника (TECHNIQUE) - 1 модуль
 * 4. Заминка (COOLDOWN) - 1 модуль
 */
async function selectModulesForWorkout(
  loadDirection: LoadDirection,
  targetRPE: number,
  availableTime: number,
  excludeModuleIds: string[]
) {
  const modules: any[] = [];

  // 1. РАЗМИНКА (обязательна)
  const warmup = await prisma.trainingModule.findFirst({
    where: {
      type: ModuleType.WARMUP,
      id: { notIn: excludeModuleIds },
      rpeMax: { lte: 5 }, // разминка всегда легкая
    },
    orderBy: { createdAt: 'desc' },
  });

  if (warmup) {
    modules.push(warmup);
  }

  // 2. ФИЗИЧЕСКАЯ ПОДГОТОВКА (стержневой модуль)
  // Подбираем по loadDirection и targetRPE
  const fitness = await prisma.trainingModule.findFirst({
    where: {
      type: ModuleType.FITNESS,
      id: { notIn: [...excludeModuleIds, ...(warmup ? [warmup.id] : [])] },
      rpeMin: { lte: targetRPE + 2 },
      rpeMax: { gte: targetRPE - 2 },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (fitness) {
    modules.push(fitness);
  }

  // 3. ТЕХНИКА
  // Подбираем совместимую с физ подготовкой
  const technique = await prisma.trainingModule.findFirst({
    where: {
      type: ModuleType.TECHNIQUE,
      id: { 
        notIn: [
          ...excludeModuleIds,
          ...modules.map((m) => m.id),
        ] 
      },
      rpeMin: { lte: targetRPE + 2 },
      rpeMax: { gte: targetRPE - 2 },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (technique) {
    modules.push(technique);
  }

  // 4. ЗАМИНКА (обязательна)
  const cooldown = await prisma.trainingModule.findFirst({
    where: {
      type: ModuleType.COOLDOWN,
      id: {
        notIn: [
          ...excludeModuleIds,
          ...modules.map((m) => m.id),
        ],
      },
      rpeMax: { lte: 4 }, // заминка всегда легкая
    },
    orderBy: { createdAt: 'desc' },
  });

  if (cooldown) {
    modules.push(cooldown);
  }

  return modules;
}
