import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/videos/[id]/tags - Получить теги видео
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Получаем все связи VideoTag для данного видео
    const videoTags = await prisma.videoTag.findMany({
      where: { videoId: id },
      include: {
        tag: true, // Подтягиваем полные данные тегов
      },
    });

    // Возвращаем только теги (без промежуточной таблицы)
    const tags = videoTags.map(vt => vt.tag);

    return NextResponse.json({ tags });
  } catch (error) {
    console.error('Error fetching video tags:', error);
    return NextResponse.json(
      { error: 'Ошибка при получении тегов видео' },
      { status: 500 }
    );
  }
}

// POST /api/videos/[id]/tags - Добавить теги к видео
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { tagIds } = body;

    if (!Array.isArray(tagIds) || tagIds.length === 0) {
      return NextResponse.json(
        { error: 'tagIds должен быть непустым массивом' },
        { status: 400 }
      );
    }

    // Проверяем, существует ли видео
    const video = await prisma.video.findUnique({
      where: { id },
    });

    if (!video) {
      return NextResponse.json(
        { error: 'Видео не найдено' },
        { status: 404 }
      );
    }

    // Создаем связи VideoTag для каждого тега
    const videoTags = await Promise.all(
      tagIds.map(tagId =>
        prisma.videoTag.create({
          data: {
            videoId: id,
            tagId: tagId,
          },
        })
      )
    );

    return NextResponse.json({ 
      success: true, 
      count: videoTags.length,
      message: `Добавлено ${videoTags.length} тегов` 
    });
  } catch (error) {
    console.error('Error adding video tags:', error);
    return NextResponse.json(
      { error: 'Ошибка при добавлении тегов к видео' },
      { status: 500 }
    );
  }
}

// DELETE /api/videos/[id]/tags - Удалить все теги видео
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Удаляем все связи VideoTag для данного видео
    const result = await prisma.videoTag.deleteMany({
      where: { videoId: id },
    });

    return NextResponse.json({ 
      success: true, 
      deleted: result.count,
      message: `Удалено ${result.count} тегов` 
    });
  } catch (error) {
    console.error('Error deleting video tags:', error);
    return NextResponse.json(
      { error: 'Ошибка при удалении тегов видео' },
      { status: 500 }
    );
  }
}
