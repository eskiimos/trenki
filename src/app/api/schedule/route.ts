import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTelegramId } from '@/lib/auth-server';

export async function GET(req: NextRequest) {
  try {
    const telegramId = getTelegramId(req);
    if (!telegramId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { telegramId },
    });

    if (!user) {
      return NextResponse.json([]);
    }

    const { searchParams } = new URL(req.url);
    const month = searchParams.get('month');
    const year = searchParams.get('year');

    let dateFilter = {};
    if (month && year) {
      const startDate = new Date(parseInt(year), parseInt(month), 1);
      const endDate = new Date(parseInt(year), parseInt(month) + 1, 0);
      dateFilter = {
        date: {
          gte: startDate,
          lte: endDate,
        },
      };
    }

    const scheduledWorkouts = await prisma.scheduledWorkout.findMany({
      where: {
        userId: user.id,
        ...dateFilter,
      },
      include: {
        video: {
          select: {
            id: true,
            title: true,
            thumbnail: true,
            duration: true,
            level: true,
            equipment: true,
            category: true,
            trainer: {
              select: {
                name: true,
                lastName: true,
                avatar: true,
              }
            }
          },
        },
      },
      orderBy: {
        date: 'asc',
      },
    });

    return NextResponse.json(scheduledWorkouts);
  } catch (error: any) {
    console.error('Error fetching scheduled workouts:', error);
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const telegramId = getTelegramId(req);
    console.log('POST /api/schedule - telegramId:', telegramId);
    
    if (!telegramId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let user = await prisma.user.findUnique({
      where: { telegramId },
    });
    console.log('POST /api/schedule - user found:', user ? user.id : 'null');

    if (!user) {
      // Create user if not found (auto-registration for guests)
      try {
        user = await prisma.user.create({
          data: {
            telegramId,
            firstName: 'Guest',
            profile: {
              create: {
                strength: 16,
                endurance: 22,
                speed: 55,
                technique: 22,
                overall: 28,
                dailyProgress: 0,
                maxDailyGoal: 10
              }
            }
          }
        });
        console.log('POST /api/schedule - user created:', user.id);
      } catch (createError: any) {
        console.error('POST /api/schedule - error creating user:', createError);
        // If creation fails (e.g. race condition), try to find again
        user = await prisma.user.findUnique({ where: { telegramId } });
        if (!user) {
           throw new Error(`Failed to create user: ${createError.message}`);
        }
      }
    }

    const body = await req.json();
    console.log('POST /api/schedule - body:', JSON.stringify(body));
    const { videoId, dates } = body;

    if (!videoId || !dates || !Array.isArray(dates)) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const createdSchedules = [];

    for (const dateString of dates) {
      const date = new Date(dateString);
      
      // Check if already scheduled for this video on this date
      const existing = await prisma.scheduledWorkout.findFirst({
        where: {
          userId: user.id,
          videoId,
          date,
        },
      });

      if (!existing) {
        const schedule = await prisma.scheduledWorkout.create({
          data: {
            userId: user.id,
            videoId,
            date,
          },
        });
        createdSchedules.push(schedule);
      }
    }

    return NextResponse.json(createdSchedules);
  } catch (error: any) {
    console.error('Error creating scheduled workouts:', error);
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const telegramId = getTelegramId(req);
    if (!telegramId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { telegramId },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Schedule ID required' }, { status: 400 });
    }

    // Verify ownership
    const schedule = await prisma.scheduledWorkout.findUnique({
      where: { id },
    });

    if (!schedule) {
      return NextResponse.json({ error: 'Schedule not found' }, { status: 404 });
    }

    if (schedule.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await prisma.scheduledWorkout.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting scheduled workout:', error);
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error.message 
    }, { status: 500 });
  }
}
