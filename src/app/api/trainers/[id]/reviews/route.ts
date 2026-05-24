import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTelegramId } from '@/lib/auth';

// GET - получить все отзывы тренера
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const reviews = await prisma.trainerReview.findMany({
      where: { 
        trainerId: id,
        isApproved: true // Показываем только одобренные отзывы
      },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            profile: {
              select: {
                avatarUrl: true
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return NextResponse.json({ reviews });
  } catch (error: any) {
    console.error('Error fetching reviews:', error);
    return NextResponse.json({ 
      error: 'Internal server error', 
    }, { status: 500 });
  }
}

// POST - создать новый отзыв
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: trainerId } = await params;
    const telegramId = getTelegramId();

    if (!telegramId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Найти пользователя
    const user = await prisma.user.findUnique({
      where: { telegramId }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await request.json();
    const { rating, comment } = body;

    if (!rating || rating < 1 || rating > 5) {
      return NextResponse.json({ 
        error: 'Invalid rating. Must be between 1 and 5' 
      }, { status: 400 });
    }

    // Проверить, нет ли уже отзыва от этого пользователя
    const existingReview = await prisma.trainerReview.findFirst({
      where: {
        trainerId,
        userId: user.id
      }
    });

    if (existingReview) {
      // Обновить существующий отзыв
      const updatedReview = await prisma.trainerReview.update({
        where: { id: existingReview.id },
        data: {
          rating,
          comment: comment || null,
          createdAt: new Date() // Обновляем дату
        },
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              profile: {
                select: {
                  avatarUrl: true
                }
              }
            }
          }
        }
      });

      // Пересчитать средний рейтинг тренера
      const allReviews = await prisma.trainerReview.findMany({
        where: { trainerId }
      });

      const averageRating = allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length;

      await prisma.trainer.update({
        where: { id: trainerId },
        data: { rating: Math.round(averageRating * 10) / 10 }
      });

      return NextResponse.json({ review: updatedReview });
    }

    // Создать новый отзыв
    const review = await prisma.trainerReview.create({
      data: {
        trainerId,
        userId: user.id,
        rating,
        comment: comment || null,
      },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            profile: {
              select: {
                avatarUrl: true
              }
            }
          }
        }
      }
    });

    // Пересчитать средний рейтинг тренера
    const allReviews = await prisma.trainerReview.findMany({
      where: { trainerId }
    });

    const averageRating = allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length;

    await prisma.trainer.update({
      where: { id: trainerId },
      data: { rating: Math.round(averageRating * 10) / 10 }
    });

    return NextResponse.json({ review }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating review:', error);
    return NextResponse.json({ 
      error: 'Internal server error', 
    }, { status: 500 });
  }
}
