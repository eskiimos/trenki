import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminAsync } from '@/lib/admin-session';

// GET - получить все отзывы для модерации
export async function GET(request: NextRequest) {
  const denied = await requireAdminAsync(request);
  if (denied) return denied;
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status'); // 'pending' | 'approved' | 'all'

    const where = status === 'pending' 
      ? { isApproved: false }
      : status === 'approved'
      ? { isApproved: true }
      : {}; // all

    const reviews = await prisma.trainerReview.findMany({
      where,
      include: {
        trainer: {
          select: {
            id: true,
            name: true,
            lastName: true,
            avatar: true,
          }
        },
        user: {
          select: {
            id: true,
            telegramId: true,
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
      details: error.message 
    }, { status: 500 });
  }
}
