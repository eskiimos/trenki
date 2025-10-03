import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    
    const trainer = await prisma.trainer.findUnique({
      where: { id },
      include: {
        videos: {
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!trainer) {
      return NextResponse.json({ error: 'Trainer not found' }, { status: 404 });
    }

    return NextResponse.json({ trainer });
  } catch (error) {
    console.error('Error fetching trainer:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const { name, lastName, speciality, experience, rating, avatar, description } = body;

    const trainer = await prisma.trainer.update({
      where: { id },
      data: {
        name,
        lastName,
        speciality,
        experience,
        rating,
        avatar,
        description
      }
    });

    return NextResponse.json({ trainer });
  } catch (error) {
    console.error('Error updating trainer:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    // Проверяем, есть ли у тренера привязанные видео
    const trainer = await prisma.trainer.findUnique({
      where: { id },
      include: {
        videos: true
      }
    });

    if (!trainer) {
      return NextResponse.json({ error: 'Trainer not found' }, { status: 404 });
    }

    if (trainer.videos.length > 0) {
      return NextResponse.json({ 
        error: 'Cannot delete trainer with existing videos. Please reassign or delete videos first.' 
      }, { status: 400 });
    }

    await prisma.trainer.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting trainer:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
