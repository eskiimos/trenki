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
    const monthNum = month === null ? NaN : parseInt(month, 10);
    const yearNum = year === null ? NaN : parseInt(year, 10);
    if (Number.isInteger(monthNum) && Number.isInteger(yearNum) && monthNum >= 0 && monthNum <= 11) {
      // Окно — ПОЛУИНТЕРВАЛ [первое число месяца − 1 день; первое число следующего + 1 день).
      //
      // Было `lte: new Date(y, m+1, 0)` — это последний день в 00:00, поэтому
      // тренировка, назначенная на последний день месяца на любое время кроме
      // полуночи, в календарь не попадала вовсе.
      //
      // Запас в сутки с обеих сторон — на расхождение таймзоны сервера и
      // устройства: клиент всё равно раскладывает записи по дням через isSameDay
      // в локальном времени, лишние сутки он просто не покажет.
      const startDate = new Date(yearNum, monthNum, 0); // = последний день предыдущего месяца, 00:00
      const endDate = new Date(yearNum, monthNum + 1, 2); // = 2-е число следующего месяца, 00:00
      dateFilter = {
        date: {
          gte: startDate,
          lt: endDate,
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
        .map(d => ({ userId: user.id, videoId, date: d, notificationSent: false }));

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
