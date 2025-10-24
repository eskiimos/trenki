import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    const { 
      title, 
      description, 
      duration, 
      videoUrl, 
      thumbnail, 
      category, 
      difficulty, 
      trainerId,
      tags,
      equipment,
      level,
      isPublished,
      rpeМін,
      rpeМакс,
    } = body;

    if (!title || !videoUrl || !category || !difficulty || !trainerId) {
      return NextResponse.json({ 
        error: 'title, videoUrl, category, difficulty, and trainerId are required' 
      }, { status: 400 });
    }

        // Преобразуем RPE в числа
    const rpeМинNum = rpeМін ? parseInt(rpeМін.toString()) : null;
    const rpeМаксNum = rpeМакс ? parseInt(rpeМакс.toString()) : null;

    // Обновляем видео
    const video = await prisma.video.update({
      where: { id },
      data: {
        title,
        description: description || '',
        duration: typeof duration === 'string' ? parseInt(duration) : duration,
        videoUrl,
        thumbnail: thumbnail || '',
        category,
        difficulty,
        trainerId,
        tags: tags || [],
        equipment: equipment || [],
        level: level || '',
        isPublished: isPublished !== undefined ? isPublished : true,
        rpeМин: rpeМинNum,
        rpeМакс: rpeМаксNum,
      },
      include: {
        trainer: {
          select: {
            id: true,
            name: true,
            lastName: true,
            speciality: true,
          },
        },
      },
    });

    return NextResponse.json({ 
      success: true,
      video,
      message: 'Video updated successfully' 
    });
  } catch (error: any) {
    console.error('Error updating video:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error.message 
    }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    await prisma.video.delete({
      where: { id },
    });

    return NextResponse.json({ 
      success: true,
      message: 'Video deleted successfully' 
    });
  } catch (error: any) {
    console.error('Error deleting video:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error.message 
    }, { status: 500 });
  }
}
