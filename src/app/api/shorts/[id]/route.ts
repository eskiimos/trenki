import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET - получить short по ID
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    
    const short = await prisma.short.findUnique({
      where: { id },
    });

    if (!short) {
      return NextResponse.json({ error: 'Short not found' }, { status: 404 });
    }

    return NextResponse.json({ short });
  } catch (error) {
    console.error('Error fetching short:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - обновить short
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await request.json();

    const short = await prisma.short.update({
      where: { id },
      data: {
        title: body.title,
        description: body.description,
        videoUrl: body.videoUrl,
        thumbnail: body.thumbnail,
        trainerId: body.trainerId || null,
        tags: body.tags || [],
        isPublished: body.isPublished,
        order: body.order,
      },
    });

    return NextResponse.json({ short });
  } catch (error: any) {
    console.error('Error updating short:', error);
    return NextResponse.json({ 
      error: 'Failed to update short',
      details: error.message 
    }, { status: 500 });
  }
}

// DELETE - удалить short
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    await prisma.short.delete({
      where: { id },
    });

    return NextResponse.json({ message: 'Short deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting short:', error);
    return NextResponse.json({ 
      error: 'Failed to delete short',
      details: error.message 
    }, { status: 500 });
  }
}
