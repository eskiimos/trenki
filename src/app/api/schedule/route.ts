import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuthUser } from '@/lib/coach/guards';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuthUser(req);
    if ('response' in auth) return auth.response;
    const user = auth.user;

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
              },
            },
          },
        },
      },
      orderBy: { date: 'asc' },
    });

    return NextResponse.json(scheduledWorkouts);
  } catch (error) {
    console.error('Error fetching scheduled workouts:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuthUser(req);
    if ('response' in auth) return auth.response;
    const user = auth.user;

    const body = await req.json();
    const { videoId, dates } = body;

    if (!videoId || !Array.isArray(dates)) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const video = await prisma.video.findUnique({
      where: { id: videoId },
      select: { id: true },
    });
    if (!video) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    // Нормализуем и дедуплицируем даты на стороне приложения.
    const parsedDates = (dates as string[])
      .map(d => new Date(d))
      .filter(d => !Number.isNaN(d.getTime()));
    const uniqueDates = Array.from(new Set(parsedDates.map(d => d.toISOString()))).map(
      iso => new Date(iso),
    );

    if (uniqueDates.length === 0) {
      return NextResponse.json([]);
    }

    // Атомарно: ищем уже существующие записи и одной операцией добавляем недостающие.
    const created = await prisma.$transaction(async tx => {
      const existing = await tx.scheduledWorkout.findMany({
        where: {
          userId: user.id,
          videoId,
          date: { in: uniqueDates },
        },
        select: { date: true },
      });
      const existingIso = new Set(existing.map(e => e.date.toISOString()));
      const toCreate = uniqueDates
        .filter(d => !existingIso.has(d.toISOString()))
        .map(d => ({ userId: user.id, videoId, date: d, notificationSent: true }));

      if (toCreate.length === 0) return [];

      await tx.scheduledWorkout.createMany({ data: toCreate });
      return tx.scheduledWorkout.findMany({
        where: {
          userId: user.id,
          videoId,
          date: { in: toCreate.map(d => d.date) },
        },
        orderBy: { date: 'asc' },
      });
    });

    return NextResponse.json(created);
  } catch (error) {
    console.error('Error creating scheduled workouts:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireAuthUser(req);
    if ('response' in auth) return auth.response;
    const user = auth.user;

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Schedule ID required' }, { status: 400 });
    }

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
  } catch (error) {
    console.error('Error deleting scheduled workout:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
