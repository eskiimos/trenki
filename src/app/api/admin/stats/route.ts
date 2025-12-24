import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    const twoMinutesAgo = new Date(now.getTime() - 2 * 60 * 1000);

    // ===== ПОЛЬЗОВАТЕЛИ =====
    const totalUsers = await prisma.user.count();
    const usersToday = await prisma.user.count({
      where: { createdAt: { gte: today } }
    });
    const usersYesterday = await prisma.user.count({
      where: { createdAt: { gte: yesterday, lt: today } }
    });
    const usersThisWeek = await prisma.user.count({
      where: { createdAt: { gte: weekAgo } }
    });
    const usersThisMonth = await prisma.user.count({
      where: { createdAt: { gte: monthAgo } }
    });

    // Активные пользователи (были онлайн)
    const activeToday = await prisma.user.count({
      where: { lastActivity: { gte: today } }
    });
    const activeThisWeek = await prisma.user.count({
      where: { lastActivity: { gte: weekAgo } }
    });
    const activeThisMonth = await prisma.user.count({
      where: { lastActivity: { gte: monthAgo } }
    });
    const onlineNow = await prisma.user.count({
      where: { lastActivity: { gte: twoMinutesAgo } }
    });

    // Email и Push
    const verifiedEmails = await prisma.user.count({
      where: { emailVerified: true }
    });
    const pushSubscriptions = await prisma.pushSubscription.count();

    // ===== КОНТЕНТ =====
    const totalVideos = await prisma.video.count();
    const publishedVideos = await prisma.video.count({
      where: { isPublished: true }
    });
    const totalShorts = await prisma.short.count();
    const publishedShorts = await prisma.short.count({
      where: { isPublished: true }
    });
    const totalTrainers = await prisma.trainer.count();

    // Просмотры и лайки
    const videoStats = await prisma.video.aggregate({
      _sum: { viewsCount: true, likesCount: true }
    });
    const shortStats = await prisma.short.aggregate({
      _sum: { viewsCount: true, likesCount: true }
    });

    // Комментарии
    const totalComments = await prisma.shortComment.count();
    const commentsToday = await prisma.shortComment.count({
      where: { createdAt: { gte: today } }
    });

    // ===== ТРЕНИРОВКИ =====
    const totalSessions = await prisma.trainingSession.count();
    const completedSessions = await prisma.trainingSession.count({
      where: { completed: true }
    });
    const sessionsToday = await prisma.trainingSession.count({
      where: { createdAt: { gte: today } }
    });
    const sessionsThisWeek = await prisma.trainingSession.count({
      where: { createdAt: { gte: weekAgo } }
    });

    // ===== ИЗБРАННОЕ =====
    const totalFavorites = await prisma.favoriteVideo.count();

    // ===== ПРОФИЛИ =====
    const profilesWithPosition = await prisma.profile.count({
      where: { position: { not: null } }
    });
    const profilesWithAvatar = await prisma.profile.count({
      where: { avatarUrl: { not: null } }
    });

    // Распределение по позициям
    const positionDistribution = await prisma.profile.groupBy({
      by: ['position'],
      _count: true,
      where: { position: { not: null } }
    });

    // Распределение по полу
    const genderDistribution = await prisma.profile.groupBy({
      by: ['gender'],
      _count: true,
      where: { gender: { not: null } }
    });

    // ===== РЕГИСТРАЦИИ ПО ДНЯМ (последние 30 дней) =====
    // Получаем все пользователи за последний месяц и группируем на клиенте
    const usersLastMonth = await prisma.user.findMany({
      where: { createdAt: { gte: monthAgo } },
      select: { createdAt: true },
      orderBy: { createdAt: 'asc' }
    });

    const registrationsByDay = usersLastMonth.reduce((acc, user) => {
      const dateStr = user.createdAt.toISOString().split('T')[0];
      acc[dateStr] = (acc[dateStr] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // ===== АКТИВНОСТЬ ПО ЧАСАМ (сегодня) =====
    const activeUsersToday = await prisma.user.findMany({
      where: { lastActivity: { gte: today } },
      select: { lastActivity: true }
    });

    const activityByHour = activeUsersToday.reduce((acc, user) => {
      const hour = user.lastActivity.getHours();
      acc[hour] = (acc[hour] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);

    // ===== ТРЕНИРОВКИ ПО ДНЯМ (последние 30 дней) =====
    const sessionsLastMonth = await prisma.trainingSession.findMany({
      where: { createdAt: { gte: monthAgo } },
      select: { createdAt: true },
      orderBy: { createdAt: 'asc' }
    });

    const sessionsByDay = sessionsLastMonth.reduce((acc, session) => {
      const dateStr = session.createdAt.toISOString().split('T')[0];
      acc[dateStr] = (acc[dateStr] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // ===== ТОП КОНТЕНТ =====
    const topVideos = await prisma.video.findMany({
      take: 5,
      orderBy: { viewsCount: 'desc' },
      select: {
        id: true,
        title: true,
        viewsCount: true,
        likesCount: true,
        thumbnail: true
      }
    });

    const topShorts = await prisma.short.findMany({
      take: 5,
      orderBy: { viewsCount: 'desc' },
      select: {
        id: true,
        title: true,
        viewsCount: true,
        likesCount: true,
        thumbnail: true
      }
    });

    // ===== ПОСЛЕДНИЕ РЕГИСТРАЦИИ =====
    const recentUsers = await prisma.user.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        username: true,
        createdAt: true,
        lastActivity: true
      }
    });

    // ===== КАТЕГОРИИ ВИДЕО =====
    const videosByCategory = await prisma.video.groupBy({
      by: ['category'],
      _count: true,
      where: { isPublished: true }
    });

    // ===== СЛОЖНОСТЬ ВИДЕО =====
    const videosByDifficulty = await prisma.video.groupBy({
      by: ['difficulty'],
      _count: true,
      where: { isPublished: true }
    });

    // ===== ОТЗЫВЫ =====
    const totalReviews = await prisma.trainerReview.count();
    const pendingReviews = await prisma.trainerReview.count({
      where: { isApproved: false }
    });
    const avgRating = await prisma.trainerReview.aggregate({
      _avg: { rating: true }
    });

    return NextResponse.json({
      users: {
        total: totalUsers,
        today: usersToday,
        yesterday: usersYesterday,
        thisWeek: usersThisWeek,
        thisMonth: usersThisMonth,
        growth: usersYesterday > 0 ? ((usersToday - usersYesterday) / usersYesterday * 100).toFixed(1) : 0
      },
      activity: {
        onlineNow,
        activeToday,
        activeThisWeek,
        activeThisMonth,
        dauRate: totalUsers > 0 ? ((activeToday / totalUsers) * 100).toFixed(1) : 0,
        wauRate: totalUsers > 0 ? ((activeThisWeek / totalUsers) * 100).toFixed(1) : 0,
        mauRate: totalUsers > 0 ? ((activeThisMonth / totalUsers) * 100).toFixed(1) : 0
      },
      engagement: {
        verifiedEmails,
        emailVerificationRate: totalUsers > 0 ? ((verifiedEmails / totalUsers) * 100).toFixed(1) : 0,
        pushSubscriptions,
        pushSubscriptionRate: totalUsers > 0 ? ((pushSubscriptions / totalUsers) * 100).toFixed(1) : 0,
        profilesWithPosition,
        profileCompletionRate: totalUsers > 0 ? ((profilesWithPosition / totalUsers) * 100).toFixed(1) : 0,
        profilesWithAvatar
      },
      content: {
        videos: {
          total: totalVideos,
          published: publishedVideos,
          views: videoStats._sum.viewsCount || 0,
          likes: videoStats._sum.likesCount || 0
        },
        shorts: {
          total: totalShorts,
          published: publishedShorts,
          views: shortStats._sum.viewsCount || 0,
          likes: shortStats._sum.likesCount || 0
        },
        trainers: totalTrainers,
        comments: {
          total: totalComments,
          today: commentsToday
        },
        favorites: totalFavorites
      },
      training: {
        total: totalSessions,
        completed: completedSessions,
        completionRate: totalSessions > 0 ? ((completedSessions / totalSessions) * 100).toFixed(1) : 0,
        today: sessionsToday,
        thisWeek: sessionsThisWeek
      },
      reviews: {
        total: totalReviews,
        pending: pendingReviews,
        avgRating: avgRating._avg.rating?.toFixed(1) || 0
      },
      distributions: {
        positions: positionDistribution.map(p => ({
          position: p.position,
          count: p._count
        })),
        genders: genderDistribution.map(g => ({
          gender: g.gender,
          count: g._count
        })),
        categories: videosByCategory.map(c => ({
          category: c.category,
          count: c._count
        })),
        difficulties: videosByDifficulty.map(d => ({
          difficulty: d.difficulty,
          count: d._count
        }))
      },
      charts: {
        registrations: Object.entries(registrationsByDay).map(([date, count]) => ({
          date,
          count
        })),
        activity: Object.entries(activityByHour).map(([hour, count]) => ({
          hour: parseInt(hour),
          count
        })),
        sessions: Object.entries(sessionsByDay).map(([date, count]) => ({
          date,
          count
        }))
      },
      top: {
        videos: topVideos,
        shorts: topShorts
      },
      recent: {
        users: recentUsers
      },
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
