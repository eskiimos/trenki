import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// GET /api/training/modules/:id - Получить модуль по ID
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const module = await prisma.trainingModule.findUnique({
      where: { id: params.id },
      include: {
        video: {
          include: {
            trainer: true,
          },
        },
      },
    });

    if (!module) {
      return NextResponse.json(
        {
          success: false,
          error: 'Модуль не найден',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      module,
    });
  } catch (error) {
    console.error('Error fetching training module:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Ошибка при получении модуля',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// PUT /api/training/modules/:id - Обновить модуль
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const {
      name,
      description,
      type,
      videoId,
      loadType,
      muscleGroup,
      complexity,
      rpeMin,
      rpeMax,
      order,
    } = body;

    // Валидация обязательных полей
    if (!name || !type) {
      return NextResponse.json(
        {
          success: false,
          error: 'Название и тип модуля обязательны',
        },
        { status: 400 }
      );
    }

    // Валидация RPE
    if (rpeMin !== null && rpeMin !== undefined && (rpeMin < 1 || rpeMin > 10)) {
      return NextResponse.json(
        {
          success: false,
          error: 'RPE Min должен быть от 1 до 10',
        },
        { status: 400 }
      );
    }

    if (rpeMax !== null && rpeMax !== undefined && (rpeMax < 1 || rpeMax > 10)) {
      return NextResponse.json(
        {
          success: false,
          error: 'RPE Max должен быть от 1 до 10',
        },
        { status: 400 }
      );
    }

    if (rpeMin && rpeMax && rpeMin > rpeMax) {
      return NextResponse.json(
        {
          success: false,
          error: 'RPE Min не может быть больше RPE Max',
        },
        { status: 400 }
      );
    }

    // Получаем длительность из видео, если указано
    let duration = 0;
    if (videoId) {
      const video = await prisma.video.findUnique({
        where: { id: videoId },
        select: { duration: true },
      });
      if (video) {
        duration = video.duration;
      }
    }

    // Обновляем модуль
    const module = await prisma.trainingModule.update({
      where: { id: params.id },
      data: {
        name,
        description: description || null,
        type,
        duration,
        videoId: videoId || null,
        loadType: loadType || null,
        muscleGroup: muscleGroup || null,
        complexity: complexity || 'BEGINNER',
        rpeMin: rpeMin || null,
        rpeMax: rpeMax || null,
        order: order || 0,
      },
      include: {
        video: {
          include: {
            trainer: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      module,
    });
  } catch (error) {
    console.error('Error updating training module:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Ошибка при обновлении модуля',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// DELETE /api/training/modules/:id - Удалить модуль
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Проверяем, используется ли видео в тренировках
    const usageCount = await prisma.workoutSessionVideo.count({
      where: { videoId: params.id },
    });

    if (usageCount > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Невозможно удалить модуль. Он используется в ${usageCount} тренировках.`,
        },
        { status: 400 }
      );
    }

    // Удаляем модуль
    await prisma.trainingModule.delete({
      where: { id: params.id },
    });

    return NextResponse.json({
      success: true,
      message: 'Модуль успешно удален',
    });
  } catch (error) {
    console.error('Error deleting training module:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Ошибка при удалении модуля',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
