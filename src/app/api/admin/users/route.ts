import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    // Получаем всех пользователей с их профилями и связанными данными
    const users = await prisma.user.findMany({
      include: {
        profile: true,
        favorites: {
          select: { id: true }
        },
        sessions: {
          select: { 
            id: true,
            completed: true,
            createdAt: true
          },
          orderBy: { createdAt: 'desc' },
          take: 10 // Последние 10 сессий
        },
        videoLikes: {
          select: { id: true }
        },
        shortLikes: {
          select: { id: true }
        },
        shortComments: {
          select: { id: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Для каждого пользователя получаем информацию о подписке на push
    const usersWithStats = await Promise.all(
      users.map(async (user) => {
        // Проверяем подписку на push-уведомления
        const pushSubscription = await prisma.pushSubscription.findFirst({
          where: { userId: user.id }
        });

        // Считаем активность
        const completedSessions = user.sessions.filter(s => s.completed).length;
        const totalSessions = user.sessions.length;

        return {
          id: user.id,
          telegramId: user.telegramId,
          firstName: user.firstName,
          lastName: user.lastName,
          username: user.username,
          email: user.email,
          emailVerified: user.emailVerified,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
          lastActivity: user.lastActivity || user.updatedAt,
          
          // Профиль
          profile: user.profile ? {
            position: user.profile.position,
            gender: user.profile.gender,
            number: user.profile.number,
            birthDate: user.profile.birthDate,
            age: user.profile.birthDate ? (() => {
              const today = new Date();
              const birthDate = new Date(user.profile.birthDate);
              let age = today.getFullYear() - birthDate.getFullYear();
              const monthDiff = today.getMonth() - birthDate.getMonth();
              if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
                age--;
              }
              return age;
            })() : null,
            ageGroup: user.profile.ageGroup,
            height: user.profile.height,
            weight: user.profile.weight,
            overall: user.profile.overall,
            dailyProgress: user.profile.dailyProgress,
            maxDailyGoal: user.profile.maxDailyGoal,
          } : null,
          
          // Статистика активности
          stats: {
            favoritesCount: user.favorites.length,
            completedSessions,
            totalSessions,
            completionRate: totalSessions > 0 
              ? Math.round((completedSessions / totalSessions) * 100) 
              : 0,
            videoLikesCount: user.videoLikes.length,
            shortLikesCount: user.shortLikes.length,
            shortCommentsCount: user.shortComments.length,
            totalInteractions: user.videoLikes.length + user.shortLikes.length + user.shortComments.length,
          },
          
          // Push-уведомления
          pushNotifications: {
            isSubscribed: !!pushSubscription,
            subscribedAt: pushSubscription?.createdAt || null,
          }
        };
      })
    );

    // Общая статистика
    const totalStats = {
      totalUsers: usersWithStats.length,
      subscribedUsers: usersWithStats.filter(u => u.pushNotifications.isSubscribed).length,
      activeUsers: usersWithStats.filter(u => u.stats.totalSessions > 0).length,
      verifiedEmails: usersWithStats.filter(u => u.emailVerified).length,
    };

    return NextResponse.json({
      users: usersWithStats,
      stats: totalStats
    });

  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { error: 'Ошибка при получении пользователей' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'userId required' },
        { status: 400 }
      );
    }

    await prisma.user.delete({
      where: { id: userId }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json(
      { error: 'Ошибка при удалении пользователя' },
      { status: 500 }
    );
  }
}
