import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const difficulty = searchParams.get('difficulty');
    const trainerId = searchParams.get('trainerId');

    const where: any = {};
    if (category) where.category = category;
    if (difficulty) where.difficulty = difficulty;
    if (trainerId) where.trainerId = trainerId;

    const videos = await prisma.video.findMany({
      where,
      include: {
        trainer: true
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({ videos });
  } catch (error) {
    console.error('Error fetching videos:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, description, duration, videoUrl, thumbnail, category, difficulty, trainerId } = body;

    if (!title || !videoUrl || !category || !difficulty || !trainerId) {
      return NextResponse.json({ 
        error: 'title, videoUrl, category, difficulty, and trainerId are required' 
      }, { status: 400 });
    }

    const video = await prisma.video.create({
      data: {
        title,
        description,
        duration: duration || 0,
        videoUrl,
        thumbnail,
        category,
        difficulty,
        trainerId
      },
      include: {
        trainer: true
      }
    });

    return NextResponse.json({ video });
  } catch (error) {
    console.error('Error creating video:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
