import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminAsync } from '@/lib/admin-session';
import { logger } from '@/lib/logger';
import {
  STATS_TZ,
  buildDailySeries,
  dayWindow,
  hourInTz,
  sumLastDays,
  zonedDayStart,
} from '@/lib/stats/daily-series';
import { ADMIN_STATS_WORKOUTS, NON_STAFF_USER_WHERE } from '@/lib/stats/workout-definition';
import {
  countCountedWorkouts,
  findCountedWorkoutDates,
  getStaffUserIds,
} from '@/lib/stats/workout-definition-server';

/** Графики и суммы «за 30 дней» — одно окно: сегодня + 29 дней до него. */
const CHART_DAYS = 30;

export async function GET(request: NextRequest) {
  const denied = await requireAdminAsync(request);
  if (denied) return denied;
  try {
    // Все границы — по Москве явно, а не по таймзоне процесса: раньше
    // `new Date(y, m, d)` давал МСК-полночь в проде (TZ контейнера), но
    // группировка по дням шла через toISOString (UTC) — ночные записи
    // уезжали во вчера, и последний столбик не совпадал с KPI «сегодня».
    const now = new Date();
    const window30 = dayWindow(CHART_DAYS, now, STATS_TZ);
    const today = zonedDayStart(window30.lastDay, STATS_TZ);
    // «За неделю» — 7 календарных дней включая сегодня (раньше было 8: today − 7 суток)
    const weekAgo = zonedDayStart(window30.lastDay - 6, STATS_TZ);
    const monthAgo = window30.since;
    const twoMinutesAgo = new Date(now.getTime() - 2 * 60 * 1000);

    // ===== РЯДЫ ЗА 30 ДНЕЙ (регистрации и тренировки) =====
    // Ровно 30 точек с нулями у обоих рядов — соседние графики на дашборде
    // всегда одной ширины и с одинаковыми датами.
    //
    // Регистрации — без аккаунтов команды (isAdmin/isTester): тестовые
    // аккаунты — шум в метрике роста, а тренировки команды исключены по
    // решению владельца; KPI и график считаем одинаково. Флаг ставится уже
    // после регистрации, поэтому помеченный тестер исчезает и из прошлых дней —
    // это и нужно. «Всего пользователей» (знаменатель DAU/WAU) не трогаем.
    //
    // Тренировка — по общему определению (см. src/lib/stats/workout-definition).
    // Список команды берём один раз на оба подсчёта (график и итог за всё время).
    const staffUserIds = await getStaffUserIds();
    const [registrationRows, workoutDates, countedWorkoutsTotal] = await Promise.all([
      prisma.user.findMany({
        where: { createdAt: { gte: window30.since }, ...NON_STAFF_USER_WHERE },
        select: { createdAt: true },
      }),
      findCountedWorkoutDates(ADMIN_STATS_WORKOUTS, { since: window30.since, staffUserIds }),
      countCountedWorkouts(ADMIN_STATS_WORKOUTS, { staffUserIds }),
    ]);
    const registrationsSeries = buildDailySeries(
      registrationRows.map((u) => u.createdAt),
      window30,
      STATS_TZ,
    );
    const sessionsSeries = buildDailySeries(workoutDates, window30, STATS_TZ);

    // ===== ПОЛЬЗОВАТЕЛИ =====
    const totalUsers = await prisma.user.count();
    // Суммы — из того же ряда, что и график: цифры в карточке и столбики сходятся
    const usersToday = sumLastDays(registrationsSeries, 1);
    const usersYesterday = registrationsSeries.at(-2)?.count ?? 0;
    const usersThisWeek = sumLastDays(registrationsSeries, 7);
    const usersThisMonth = sumLastDays(registrationsSeries, CHART_DAYS);

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

    // Комментарии — считаем обе ленты (видео + треньки), т.к. модерация общая
    const [shortCommentsTotal, videoCommentsTotal, shortCommentsToday, videoCommentsToday] =
      await Promise.all([
        prisma.shortComment.count(),
        prisma.videoComment.count(),
        prisma.shortComment.count({ where: { createdAt: { gte: today } } }),
        prisma.videoComment.count({ where: { createdAt: { gte: today } } }),
      ]);
    const totalComments = shortCommentsTotal + videoCommentsTotal;
    const commentsToday = shortCommentsToday + videoCommentsToday;

    // ===== ТРЕНИРОВКИ =====
    // Считаем по WorkoutSession (реальные тренировки), а НЕ по legacy-пустой
    // TrainingSession — иначе дашборд показывал 0. «Сегодня/неделя/график» —
    // по общему определению тренировки, из одного ряда по МСК-дням; counted —
    // то же определение за всё время (KPI «Тренировок»).
    // total/completed/completionRate — статусы ВСЕХ сессий за всё время
    // (с синтетикой, командой, закрытыми днями цикла; PARTIAL не в completed).
    // Это воронка статусов, а не «тренировки»: в UI подписана отдельно, и
    // доля не считается как counted/total — числитель и знаменатель жили бы
    // по разным правилам.
    const totalSessions = await prisma.workoutSession.count();
    const completedSessions = await prisma.workoutSession.count({
      where: { status: 'COMPLETED' }
    });
    const sessionsToday = sumLastDays(sessionsSeries, 1);
    const sessionsThisWeek = sumLastDays(sessionsSeries, 7);

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

    // ===== АКТИВНОСТЬ ПО ЧАСАМ (сегодня, МСК) =====
    // Оговорка: это час ПОСЛЕДНЕЙ активности каждого пользователя
    // (User.lastActivity), а не все его заходы за день.
    const activeUsersToday = await prisma.user.findMany({
      where: { lastActivity: { gte: today } },
      select: { lastActivity: true }
    });

    const activityByHour = activeUsersToday.reduce((acc, user) => {
      const hour = hourInTz(user.lastActivity, STATS_TZ);
      acc[hour] = (acc[hour] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);

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
        counted: countedWorkoutsTotal,
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
        // Ровно CHART_DAYS точек { date: 'YYYY-MM-DD' (МСК), count } с нулями
        registrations: registrationsSeries,
        activity: Object.entries(activityByHour).map(([hour, count]) => ({
          hour: parseInt(hour),
          count
        })),
        sessions: sessionsSeries
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
    logger.error('admin stats: failed', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
