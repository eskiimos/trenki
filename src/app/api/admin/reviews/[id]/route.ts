import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminAsync } from '@/lib/admin-session';

// PATCH - одобрить или отклонить отзыв
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requireAdminAsync(request);
  if (denied) return denied;
  try {
    const { id } = await params;
    const body = await request.json();
    const { isApproved } = body;

    if (typeof isApproved !== 'boolean') {
      return NextResponse.json({ 
        error: 'isApproved must be a boolean' 
      }, { status: 400 });
    }

    const review = await prisma.trainerReview.update({
      where: { id },
      data: { isApproved },
      include: {
        trainer: {
          select: {
            id: true,
            name: true,
            lastName: true,
          }
        },
        user: {
          select: {
            firstName: true,
            lastName: true,
          }
        }
      }
    });

    // Если отзыв одобрен, пересчитываем рейтинг тренера
    if (isApproved) {
      const allApprovedReviews = await prisma.trainerReview.findMany({
        where: { 
          trainerId: review.trainerId,
          isApproved: true
        }
      });

      if (allApprovedReviews.length > 0) {
        const averageRating = allApprovedReviews.reduce((sum, r) => sum + r.rating, 0) / allApprovedReviews.length;

        await prisma.trainer.update({
          where: { id: review.trainerId },
          data: { rating: Math.round(averageRating * 10) / 10 }
        });
      }
    }

    return NextResponse.json({ review });
  } catch (error: any) {
    console.error('Error updating review:', error);
    return NextResponse.json({ 
      error: 'Internal server error', 
    }, { status: 500 });
  }
}

// DELETE - удалить отзыв
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requireAdminAsync(request);
  if (denied) return denied;
  try {
    const { id } = await params;

    const review = await prisma.trainerReview.delete({
      where: { id }
    });

    return NextResponse.json({ success: true, review });
  } catch (error: any) {
    console.error('Error deleting review:', error);
    return NextResponse.json({ 
      error: 'Internal server error', 
    }, { status: 500 });
  }
}
