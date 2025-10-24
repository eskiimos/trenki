import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// GET /api/training/modules - Получить все модули
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type'); // Фильтр по типу модуля

    const where: any = {};
    if (type) {
      where.type = type;
    }

    const modules = await prisma.trainingModule.findMany({
      where,
      include: {
        video: {
          include: {
            trainer: true,
          },
        },
      },
      orderBy: [
        { type: 'asc' },
        { order: 'asc' },
        { name: 'asc' },
      ],
    });

    return NextResponse.json({
      success: true,
      modules,
      count: modules.length,
    });
  } catch (error) {
    console.error('Error fetching training modules:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Ошибка при получении модулей',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// POST /api/training/modules - Создать новый модуль
export async function POST(request: NextRequest) {
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

    // Создаем модуль
    const module = await prisma.trainingModule.create({
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
    console.error('Error creating training module:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Ошибка при создании модуля',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
