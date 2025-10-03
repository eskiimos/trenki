import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET - получить все опубликованные shorts
export async function GET(request: NextRequest) {
  try {
    const shorts = await prisma.short.findMany({
      where: {
        isPublished: true,
      },
      orderBy: [
        { order: 'asc' },
        { createdAt: 'desc' }
      ]
    });

    return NextResponse.json({ shorts });
  } catch (error) {
    console.error('Error fetching shorts:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - создать новый short
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('Received short body:', body);

    const short = await prisma.short.create({
      data: {
        title: body.title,
        description: body.description || '',
        videoUrl: body.videoUrl,
        thumbnail: body.thumbnail || '',
        trainerId: body.trainerId || null,
        tags: body.tags || [],
        isPublished: body.isPublished ?? true,
        order: body.order || 0,
      },
    });

    console.log('Created short:', short);

    return NextResponse.json({ short });
  } catch (error: any) {
    console.error('Error creating short:', error);
    return NextResponse.json({ 
      error: 'Failed to create short',
      details: error.message 
    }, { status: 500 });
  }
}
