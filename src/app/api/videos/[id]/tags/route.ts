import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminAsync } from '@/lib/admin-session';

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
  const denied = await requireAdminAsync(request);
  if (denied) return denied;
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

    // Используем createMany с skipDuplicates чтобы не падать на дублях
    const result = await prisma.videoTag.createMany({
      data: tagIds.map((tagId: string) => ({ videoId: id, tagId })),
      skipDuplicates: true,
    });

    return NextResponse.json({
      success: true,
      count: result.count,
      message: `Добавлено ${result.count} тегов`
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
  const denied = await requireAdminAsync(request);
  if (denied) return denied;
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
