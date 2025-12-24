'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';

interface Stats {
  users: {
    total: number;
    today: number;
    yesterday: number;
    thisWeek: number;
    thisMonth: number;
    growth: string;
  };
  activity: {
    onlineNow: number;
    activeToday: number;
    activeThisWeek: number;
    activeThisMonth: number;
    dauRate: string;
    wauRate: string;
    mauRate: string;
  };
  engagement: {
    verifiedEmails: number;
    emailVerificationRate: string;
    pushSubscriptions: number;
    pushSubscriptionRate: string;
    profilesWithPosition: number;
    profileCompletionRate: string;
    profilesWithAvatar: number;
  };
  content: {
    videos: {
      total: number;
      published: number;
      views: number;
      likes: number;
    };
    shorts: {
      total: number;
      published: number;
      views: number;
      likes: number;
    };
    trainers: number;
    comments: {
      total: number;
      today: number;
    };
    favorites: number;
  };
  training: {
    total: number;
    completed: number;
    completionRate: string;
    today: number;
    thisWeek: number;
  };
  reviews: {
    total: number;
    pending: number;
    avgRating: string;
  };
  distributions: {
    positions: Array<{ position: string; count: number }>;
    genders: Array<{ gender: string; count: number }>;
    categories: Array<{ category: string; count: number }>;
    difficulties: Array<{ difficulty: string; count: number }>;
  };
  charts: {
    registrations: Array<{ date: string; count: number }>;
    activity: Array<{ hour: number; count: number }>;
    sessions: Array<{ date: string; count: number }>;
  };
  top: {
    videos: Array<{
      id: string;
      title: string;
      viewsCount: number;
      likesCount: number;
      thumbnail: string | null;
    }>;
    shorts: Array<{
      id: string;
      title: string;
      viewsCount: number;
      likesCount: number;
      thumbnail: string | null;
    }>;
  };
  recent: {
    users: Array<{
      id: string;
      firstName: string | null;
      lastName: string | null;
      username: string | null;
      createdAt: string;
      lastActivity: string;
    }>;
  };
  generatedAt: string;
}

export default function AdminStatsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    fetchStats();
    
    let interval: NodeJS.Timeout;
    if (autoRefresh) {
      interval = setInterval(fetchStats, 30000); // обновление каждые 30 секунд
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh]);

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/admin/stats');
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const positionNames: Record<string, string> = {
    GOALTENDER: 'Вратарь',
    DEFENSEMAN: 'Защитник',
    LEFT_WING: 'Левый крайний',
    CENTER: 'Центр',
    RIGHT_WING: 'Правый крайний',
  };

  const categoryNames: Record<string, string> = {
    STRENGTH: 'Сила',
    CARDIO: 'Кардио',
    TECHNIQUE: 'Техника',
    FLEXIBILITY: 'Гибкость',
    SPEED: 'Скорость',
  };

  const difficultyNames: Record<string, string> = {
    BEGINNER: 'Новичок',
    INTERMEDIATE: 'Средний',
    ADVANCED: 'Продвинутый',
    PROFESSIONAL: 'Профессионал',
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#101530] text-white p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-gray-700 animate-pulse rounded-full" />
            <div className="h-8 w-48 bg-gray-700 animate-pulse rounded" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="bg-[#1a1f3a] rounded-lg p-6 animate-pulse">
                <div className="h-4 w-24 bg-gray-700 rounded mb-3" />
                <div className="h-8 w-16 bg-gray-700 rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="min-h-screen bg-[#101530] text-white p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link href="/admin">
              <button className="w-10 h-10 rounded-full bg-[#1a1f3a] hover:bg-[#2d3448] flex items-center justify-center transition-colors">
                <Image 
                  src="/icons/arrow.svg" 
                  alt="Назад" 
                  width={20} 
                  height={20}
                  style={{ transform: 'rotate(180deg)' }}
                />
              </button>
            </Link>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">Аналитика</h1>
              <p className="text-sm text-gray-400 mt-1">
                Обновлено: {formatTime(stats.generatedAt)}
              </p>
            </div>
          </div>

          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-4 py-2 rounded-lg transition-colors ${
              autoRefresh
                ? 'bg-green-600 hover:bg-green-700'
                : 'bg-gray-600 hover:bg-gray-700'
            }`}
          >
            {autoRefresh ? '🔄 Авто' : '⏸️ Пауза'}
          </button>
        </div>

        {/* Основные метрики */}
        <div className="mb-8">
          <h2 className="text-xl font-bold mb-4">📊 Ключевые показатели</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-lg p-6">
              <p className="text-sm text-blue-200 mb-1">Всего пользователей</p>
              <p className="text-3xl font-bold">{stats.users.total}</p>
              <p className="text-xs text-blue-200 mt-2">
                Сегодня: +{stats.users.today}
              </p>
            </div>

            <div className="bg-gradient-to-br from-green-600 to-green-800 rounded-lg p-6">
              <p className="text-sm text-green-200 mb-1">Онлайн сейчас</p>
              <p className="text-3xl font-bold">{stats.activity.onlineNow}</p>
              <p className="text-xs text-green-200 mt-2">
                DAU: {stats.activity.dauRate}%
              </p>
            </div>

            <div className="bg-gradient-to-br from-purple-600 to-purple-800 rounded-lg p-6">
              <p className="text-sm text-purple-200 mb-1">Тренировок</p>
              <p className="text-3xl font-bold">{stats.training.total}</p>
              <p className="text-xs text-purple-200 mt-2">
                Завершено: {stats.training.completionRate}%
              </p>
            </div>

            <div className="bg-gradient-to-br from-orange-600 to-orange-800 rounded-lg p-6">
              <p className="text-sm text-orange-200 mb-1">Видео контент</p>
              <p className="text-3xl font-bold">{stats.content.videos.published}</p>
              <p className="text-xs text-orange-200 mt-2">
                Просмотров: {stats.content.videos.views.toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        {/* Пользователи */}
        <div className="mb-8">
          <h2 className="text-xl font-bold mb-4">👥 Пользователи</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-[#1a1f3a] rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-4">Регистрации</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-400">Сегодня</span>
                  <span className="font-bold text-green-400">{stats.users.today}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Вчера</span>
                  <span className="font-bold">{stats.users.yesterday}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">За неделю</span>
                  <span className="font-bold">{stats.users.thisWeek}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">За месяц</span>
                  <span className="font-bold">{stats.users.thisMonth}</span>
                </div>
                <div className="pt-3 border-t border-gray-700">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Рост</span>
                    <span className={`font-bold ${
                      parseFloat(stats.users.growth) > 0 ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {parseFloat(stats.users.growth) > 0 ? '+' : ''}{stats.users.growth}%
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-[#1a1f3a] rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-4">Активность</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-400">Активны сегодня</span>
                  <span className="font-bold text-green-400">{stats.activity.activeToday}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Активны за неделю</span>
                  <span className="font-bold">{stats.activity.activeThisWeek}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Активны за месяц</span>
                  <span className="font-bold">{stats.activity.activeThisMonth}</span>
                </div>
                <div className="pt-3 border-t border-gray-700 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">DAU</span>
                    <span className="text-blue-400">{stats.activity.dauRate}%</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">WAU</span>
                    <span className="text-blue-400">{stats.activity.wauRate}%</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">MAU</span>
                    <span className="text-blue-400">{stats.activity.mauRate}%</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-[#1a1f3a] rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-4">Вовлеченность</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-400">Email подтвержден</span>
                  <span className="font-bold">{stats.engagement.verifiedEmails}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Конверсия</span>
                  <span className="text-green-400">{stats.engagement.emailVerificationRate}%</span>
                </div>
                <div className="flex justify-between pt-2">
                  <span className="text-gray-400">Push подписки</span>
                  <span className="font-bold">{stats.engagement.pushSubscriptions}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Конверсия</span>
                  <span className="text-green-400">{stats.engagement.pushSubscriptionRate}%</span>
                </div>
                <div className="flex justify-between pt-2">
                  <span className="text-gray-400">Заполненные профили</span>
                  <span className="font-bold">{stats.engagement.profilesWithPosition}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Конверсия</span>
                  <span className="text-green-400">{stats.engagement.profileCompletionRate}%</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Контент */}
        <div className="mb-8">
          <h2 className="text-xl font-bold mb-4">🎬 Контент</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-[#1a1f3a] rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-3">Видео</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Всего</span>
                  <span>{stats.content.videos.total}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Опубликовано</span>
                  <span className="text-green-400">{stats.content.videos.published}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Просмотров</span>
                  <span className="text-blue-400">{stats.content.videos.views.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Лайков</span>
                  <span className="text-purple-400">{stats.content.videos.likes.toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="bg-[#1a1f3a] rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-3">Shorts</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Всего</span>
                  <span>{stats.content.shorts.total}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Опубликовано</span>
                  <span className="text-green-400">{stats.content.shorts.published}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Просмотров</span>
                  <span className="text-blue-400">{stats.content.shorts.views.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Лайков</span>
                  <span className="text-purple-400">{stats.content.shorts.likes.toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="bg-[#1a1f3a] rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-3">Взаимодействие</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Комментарии</span>
                  <span>{stats.content.comments.total}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Сегодня</span>
                  <span className="text-green-400">+{stats.content.comments.today}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Избранное</span>
                  <span>{stats.content.favorites}</span>
                </div>
              </div>
            </div>

            <div className="bg-[#1a1f3a] rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-3">Отзывы</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Всего</span>
                  <span>{stats.reviews.total}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">На модерации</span>
                  <span className="text-yellow-400">{stats.reviews.pending}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Средний рейтинг</span>
                  <span className="text-orange-400">⭐ {stats.reviews.avgRating}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Тренировки */}
        <div className="mb-8">
          <h2 className="text-xl font-bold mb-4">💪 Тренировки</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-[#1a1f3a] rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-3">Статистика сессий</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-400">Всего сессий</span>
                  <span className="font-bold">{stats.training.total}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Завершено</span>
                  <span className="font-bold text-green-400">{stats.training.completed}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Процент завершения</span>
                  <span className="font-bold text-blue-400">{stats.training.completionRate}%</span>
                </div>
              </div>
            </div>

            <div className="bg-[#1a1f3a] rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-3">Активность</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-400">Сегодня</span>
                  <span className="font-bold text-green-400">{stats.training.today}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">За неделю</span>
                  <span className="font-bold">{stats.training.thisWeek}</span>
                </div>
              </div>
            </div>

            <div className="bg-[#1a1f3a] rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-3">Другое</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-400">Тренеров</span>
                  <span className="font-bold">{stats.content.trainers}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Распределения */}
        <div className="mb-8">
          <h2 className="text-xl font-bold mb-4">📈 Распределения</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Позиции */}
            <div className="bg-[#1a1f3a] rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-3">Позиции игроков</h3>
              <div className="space-y-2">
                {stats.distributions.positions.map((pos) => (
                  <div key={pos.position} className="flex justify-between text-sm">
                    <span className="text-gray-400">
                      {positionNames[pos.position] || pos.position}
                    </span>
                    <span className="font-medium">{pos.count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Пол */}
            <div className="bg-[#1a1f3a] rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-3">Распределение по полу</h3>
              <div className="space-y-2">
                {stats.distributions.genders.map((gender) => (
                  <div key={gender.gender} className="flex justify-between text-sm">
                    <span className="text-gray-400">
                      {gender.gender === 'MALE' ? 'Мужской' : 'Женский'}
                    </span>
                    <span className="font-medium">{gender.count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Категории видео */}
            <div className="bg-[#1a1f3a] rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-3">Категории видео</h3>
              <div className="space-y-2">
                {stats.distributions.categories.map((cat) => (
                  <div key={cat.category} className="flex justify-between text-sm">
                    <span className="text-gray-400">
                      {categoryNames[cat.category] || cat.category}
                    </span>
                    <span className="font-medium">{cat.count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Сложность видео */}
            <div className="bg-[#1a1f3a] rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-3">Сложность видео</h3>
              <div className="space-y-2">
                {stats.distributions.difficulties.map((diff) => (
                  <div key={diff.difficulty} className="flex justify-between text-sm">
                    <span className="text-gray-400">
                      {difficultyNames[diff.difficulty] || diff.difficulty}
                    </span>
                    <span className="font-medium">{diff.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Графики регистраций */}
        <div className="mb-8">
          <h2 className="text-xl font-bold mb-4">📅 Регистрации за 30 дней</h2>
          <div className="bg-[#1a1f3a] rounded-lg p-6">
            <div className="flex items-end justify-between h-64 gap-1">
              {stats.charts.registrations.map((day, index) => {
                const maxCount = Math.max(...stats.charts.registrations.map(d => d.count), 1);
                const height = (day.count / maxCount) * 100;
                
                return (
                  <div key={index} className="flex-1 flex flex-col items-center group">
                    <div className="relative w-full">
                      <div
                        className="bg-blue-500 hover:bg-blue-400 transition-all rounded-t relative group"
                        style={{ height: `${height * 2}px` }}
                      >
                        <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-black/80 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                          {day.count} регистраций
                        </div>
                      </div>
                    </div>
                    <span className="text-xs text-gray-400 mt-2 rotate-45 origin-left">
                      {formatDate(day.date)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* График активности по часам */}
        <div className="mb-8">
          <h2 className="text-xl font-bold mb-4">🕐 Активность по часам (сегодня)</h2>
          <div className="bg-[#1a1f3a] rounded-lg p-6">
            <div className="flex items-end justify-between h-48 gap-1">
              {Array.from({ length: 24 }, (_, hour) => {
                const data = stats.charts.activity.find(a => a.hour === hour);
                const count = data?.count || 0;
                const maxCount = Math.max(...stats.charts.activity.map(d => d.count), 1);
                const height = (count / maxCount) * 100;
                
                return (
                  <div key={hour} className="flex-1 flex flex-col items-center group">
                    <div className="relative w-full">
                      <div
                        className="bg-green-500 hover:bg-green-400 transition-all rounded-t"
                        style={{ height: `${height * 1.5}px` }}
                      >
                        <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-black/80 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                          {count} активных
                        </div>
                      </div>
                    </div>
                    <span className="text-xs text-gray-400 mt-2">{hour}:00</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ТОП контент */}
        <div className="mb-8">
          <h2 className="text-xl font-bold mb-4">🏆 ТОП-5 контента</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* ТОП видео */}
            <div className="bg-[#1a1f3a] rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-4">Популярные видео</h3>
              <div className="space-y-3">
                {stats.top.videos.map((video, index) => (
                  <div key={video.id} className="flex items-center gap-3 p-3 bg-[#2d3448] rounded-lg">
                    <span className="text-2xl font-bold text-gray-600">#{index + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{video.title}</p>
                      <div className="flex gap-3 text-sm text-gray-400 mt-1">
                        <span>👁 {video.viewsCount.toLocaleString()}</span>
                        <span>❤️ {video.likesCount.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ТОП shorts */}
            <div className="bg-[#1a1f3a] rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-4">Популярные Shorts</h3>
              <div className="space-y-3">
                {stats.top.shorts.map((short, index) => (
                  <div key={short.id} className="flex items-center gap-3 p-3 bg-[#2d3448] rounded-lg">
                    <span className="text-2xl font-bold text-gray-600">#{index + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{short.title}</p>
                      <div className="flex gap-3 text-sm text-gray-400 mt-1">
                        <span>👁 {short.viewsCount.toLocaleString()}</span>
                        <span>❤️ {short.likesCount.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Последние регистрации */}
        <div className="mb-8">
          <h2 className="text-xl font-bold mb-4">🆕 Последние регистрации</h2>
          <div className="bg-[#1a1f3a] rounded-lg p-6">
            <div className="space-y-3">
              {stats.recent.users.map((user) => (
                <div key={user.id} className="flex items-center justify-between p-3 bg-[#2d3448] rounded-lg">
                  <div>
                    <p className="font-medium">
                      {user.firstName || user.username || 'Пользователь'}
                      {user.lastName && ` ${user.lastName}`}
                    </p>
                    <p className="text-sm text-gray-400">
                      @{user.username || 'без username'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-400">
                      {formatDate(user.createdAt)} {formatTime(user.createdAt)}
                    </p>
                    <p className="text-xs text-gray-500">
                      Активность: {formatTime(user.lastActivity)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
