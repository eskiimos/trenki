import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const trainers = await prisma.trainer.findMany({
      include: {
        videos: {
          take: 3, // Показываем первые 3 видео тренера
          orderBy: { createdAt: 'desc' }
        }
      },
      orderBy: { rating: 'desc' }
    });

    return NextResponse.json({ trainers });
  } catch (error) {
    console.error('Error fetching trainers:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, lastName, speciality, experience, avatar, description } = body;

    if (!name || !lastName || !speciality) {
      return NextResponse.json({ 
        error: 'name, lastName, and speciality are required' 
      }, { status: 400 });
    }

    const trainer = await prisma.trainer.create({
      data: {
        name,
        lastName,
        speciality,
        experience: experience || 0,
        avatar,
        description
      }
    });

    return NextResponse.json({ trainer });
  } catch (error) {
    console.error('Error creating trainer:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
