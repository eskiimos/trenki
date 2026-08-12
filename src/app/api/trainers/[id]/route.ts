import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminAsync } from '@/lib/admin-session';
import { careerStartYearFromExperience } from '@/lib/trainer';

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
  const denied = await requireAdminAsync(request);
  if (denied) return denied;
  try {
    const { id } = await context.params;
    const body = await request.json();
    const { name, lastName, speciality, experience, rating, avatar, description } = body;

    // Если пришёл стаж — обновляем и legacy-снимок experience, и источник истины
    // careerStartYear (год начала карьеры), чтобы опыт продолжал деривироваться.
    const expProvided = experience !== undefined && experience !== null;
    const expYears = expProvided ? Number(experience) || 0 : undefined;

    const trainer = await prisma.trainer.update({
      where: { id },
      data: {
        name,
        lastName,
        speciality,
        experience: expYears,
        ...(expProvided ? { careerStartYear: careerStartYearFromExperience(expYears!) } : {}),
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
  const denied = await requireAdminAsync(request);
  if (denied) return denied;
  try {
    const { id } = await context.params;

    // Проверяем, есть ли у тренера привязанные видео или шортсы
    const trainer = await prisma.trainer.findUnique({
      where: { id },
      include: {
        videos: { select: { id: true } },
        shorts: { select: { id: true } }
      }
    });

    if (!trainer) {
      return NextResponse.json({ error: 'Trainer not found' }, { status: 404 });
    }

    if (trainer.videos.length > 0 || trainer.shorts.length > 0) {
      return NextResponse.json({
        error: `Нельзя удалить тренера: у него ${trainer.videos.length} тренировок и ${trainer.shorts.length} шортсов. Сначала переназначьте или удалите контент.`
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
