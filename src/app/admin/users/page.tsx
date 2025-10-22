'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';

interface UserProfile {
  position: string | null;
  gender: string | null;
  number: number | null;
  age: number | null;
  height: number | null;
  weight: number | null;
  overall: number;
  dailyProgress: number;
  maxDailyGoal: number;
}

interface UserStats {
  favoritesCount: number;
  completedSessions: number;
  totalSessions: number;
  completionRate: number;
  videoLikesCount: number;
  shortLikesCount: number;
  shortCommentsCount: number;
  totalInteractions: number;
}

interface User {
  id: string;
  telegramId: string;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  email: string | null;
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
  lastActivity: string;
  profile: UserProfile | null;
  stats: UserStats;
  pushNotifications: {
    isSubscribed: boolean;
    subscribedAt: string | null;
  };
}

interface TotalStats {
  totalUsers: number;
  subscribedUsers: number;
  activeUsers: number;
  verifiedEmails: number;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [totalStats, setTotalStats] = useState<TotalStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSubscribed, setFilterSubscribed] = useState<boolean | null>(null);
  const [sortBy, setSortBy] = useState<'createdAt' | 'lastActivity' | 'sessions'>('lastActivity');
  const [isLive, setIsLive] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [updatedUserIds, setUpdatedUserIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchUsers();
    
    // Автообновление каждые 5 секунд, если включен live режим
    let interval: NodeJS.Timeout;
    if (isLive) {
      interval = setInterval(() => {
        fetchUsers(true); // true = silent update без loader
      }, 5000); // 5 секунд
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isLive]);

  const fetchUsers = async (silent = false) => {
    try {
      if (!silent) setIsLoading(true);
      const response = await fetch('/api/admin/users');
      const data = await response.json();
      
      // Определяем пользователей с обновлениями
      if (silent && users.length > 0) {
        const updated = new Set<string>();
        
        data.users.forEach((newUser: User) => {
          const oldUser = users.find(u => u.id === newUser.id);
          
          // Новый пользователь или изменилась активность
          if (!oldUser || 
              newUser.lastActivity !== oldUser.lastActivity ||
              newUser.stats.totalSessions !== oldUser.stats.totalSessions ||
              newUser.pushNotifications.isSubscribed !== oldUser.pushNotifications.isSubscribed) {
            updated.add(newUser.id);
          }
        });
        
        if (updated.size > 0) {
          setUpdatedUserIds(updated);
          console.log(`📊 Обновлено пользователей: ${updated.size}`);
          
          // Убираем подсветку через 3 секунды
          setTimeout(() => {
            setUpdatedUserIds(new Set());
          }, 3000);
        }
      }
      
      setUsers(data.users || []);
      setTotalStats(data.stats || null);
      setLastUpdate(new Date());
      
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  // Фильтрация и сортировка
  const filteredUsers = users
    .filter(user => {
      // Поиск по имени, username, telegram ID
      const searchMatch = searchTerm === '' || 
        user.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.telegramId.includes(searchTerm);
      
      // Фильтр по подписке на push
      const subscriptionMatch = filterSubscribed === null || 
        user.pushNotifications.isSubscribed === filterSubscribed;
      
      return searchMatch && subscriptionMatch;
    })
    .sort((a, b) => {
      if (sortBy === 'createdAt') {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      } else if (sortBy === 'lastActivity') {
        return new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime();
      } else if (sortBy === 'sessions') {
        return b.stats.totalSessions - a.stats.totalSessions;
      }
      return 0;
    });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getTimeSince = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'только что';
    if (diffMins < 60) return `${diffMins} мин назад`;
    if (diffHours < 24) return `${diffHours} ч назад`;
    if (diffDays < 30) return `${diffDays} дн назад`;
    return formatDate(dateString);
  };

  const isNewUser = (createdAt: string) => {
    const date = new Date(createdAt);
    const now = new Date();
    const diffMins = Math.floor((now.getTime() - date.getTime()) / 60000);
    return diffMins < 5; // Новый если зарегистрировался менее 5 минут назад
  };

  const isOnlineNow = (lastActivity: string) => {
    const date = new Date(lastActivity);
    const now = new Date();
    const diffMins = Math.floor((now.getTime() - date.getTime()) / 60000);
    return diffMins < 2; // Онлайн если активность менее 2 минут назад
  };

  const positionMap: Record<string, string> = {
    'GOALTENDER': 'Вратарь',
    'DEFENSEMAN': 'Защитник',
    'LEFT_WING': 'Левый крайний',
    'CENTER': 'Центр',
    'RIGHT_WING': 'Правый крайний'
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#101530] text-white p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <Link href="/admin">
              <div className="w-10 h-10 rounded-full bg-[#1a1f3a] flex items-center justify-center">
                <div className="w-5 h-5 bg-gray-700 animate-pulse rounded" />
              </div>
            </Link>
            <div className="h-8 w-48 bg-gray-700 animate-pulse rounded" />
          </div>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="bg-[#1a1f3a] rounded-lg p-4 animate-pulse">
                <div className="h-6 w-3/4 bg-gray-700 rounded mb-2" />
                <div className="h-4 w-1/2 bg-gray-700 rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

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
            <h1 className="text-2xl md:text-3xl font-bold">Пользователи</h1>
          </div>

          {/* Live режим */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => fetchUsers(false)}
              disabled={isLoading}
              className="p-2 rounded-lg bg-[#1a1f3a] hover:bg-[#2d3448] transition-colors disabled:opacity-50"
              title="Обновить вручную"
            >
              <svg 
                className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`}
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" 
                />
              </svg>
            </button>
            
            <button
              onClick={() => setIsLive(!isLive)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                isLive 
                  ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30' 
                  : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${isLive ? 'bg-green-400 animate-pulse' : 'bg-gray-400'}`} />
              <span className="text-sm font-medium">{isLive ? 'LIVE' : 'OFF'}</span>
            </button>
            
            <div className="text-xs text-gray-400 hidden md:block">
              {lastUpdate.toLocaleTimeString('ru-RU')}
            </div>
          </div>
        </div>

        {/* Общая статистика */}
        {totalStats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-[#1a1f3a] rounded-lg p-4">
              <p className="text-gray-400 text-sm mb-1">Всего</p>
              <p className="text-2xl font-bold">{totalStats.totalUsers}</p>
            </div>
            <div className="bg-[#1a1f3a] rounded-lg p-4">
              <p className="text-gray-400 text-sm mb-1">Активных</p>
              <p className="text-2xl font-bold text-green-400">{totalStats.activeUsers}</p>
            </div>
            <div className="bg-[#1a1f3a] rounded-lg p-4">
              <p className="text-gray-400 text-sm mb-1">Подписаны на push</p>
              <p className="text-2xl font-bold text-blue-400">{totalStats.subscribedUsers}</p>
            </div>
            <div className="bg-[#1a1f3a] rounded-lg p-4">
              <p className="text-gray-400 text-sm mb-1">Email подтверждён</p>
              <p className="text-2xl font-bold text-purple-400">{totalStats.verifiedEmails}</p>
            </div>
          </div>
        )}

        {/* Фильтры и поиск */}
        <div className="bg-[#1a1f3a] rounded-lg p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Поиск */}
            <input
              type="text"
              placeholder="Поиск по имени, username, Telegram ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 bg-[#2d3448] text-white px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            />

            {/* Фильтр по подписке */}
            <select
              value={filterSubscribed === null ? 'all' : filterSubscribed.toString()}
              onChange={(e) => setFilterSubscribed(
                e.target.value === 'all' ? null : e.target.value === 'true'
              )}
              className="bg-[#2d3448] text-white px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="all">Все подписки</option>
              <option value="true">Подписаны на push</option>
              <option value="false">Не подписаны</option>
            </select>

            {/* Сортировка */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-[#2d3448] text-white px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="lastActivity">По активности</option>
              <option value="createdAt">По дате регистрации</option>
              <option value="sessions">По тренировкам</option>
            </select>
          </div>

          <div className="mt-3 text-sm text-gray-400">
            Найдено: {filteredUsers.length} из {users.length}
          </div>
        </div>

        {/* Список пользователей */}
        <div className="space-y-4">
          {filteredUsers.map((user) => {
            const isUpdated = updatedUserIds.has(user.id);
            
            return (
            <div
              key={user.id}
              className={`bg-[#1a1f3a] rounded-lg p-4 md:p-6 hover:bg-[#2d3448] transition-all ${
                isUpdated ? 'ring-2 ring-green-400 animate-pulse' : ''
              }`}
            >
              <div className="flex flex-col md:flex-row gap-4">
                {/* Основная информация */}
                <div className="flex-1">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-lg font-semibold flex items-center gap-2 flex-wrap">
                        {user.firstName || user.username || `User ${user.telegramId.slice(0, 8)}`}
                        {user.lastName && ` ${user.lastName}`}
                        
                        {isOnlineNow(user.lastActivity) && (
                          <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded-full flex items-center gap-1">
                            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                            Online
                          </span>
                        )}
                        
                        {isNewUser(user.createdAt) && (
                          <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded-full">
                            🆕 Новый
                          </span>
                        )}
                        
                        {user.pushNotifications.isSubscribed && (
                          <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-1 rounded-full">
                            🔔 Push
                          </span>
                        )}
                      </h3>
                      <p className="text-sm text-gray-400">
                        @{user.username || 'no_username'} • ID: {user.telegramId}
                      </p>
                      {user.profile?.position && (
                        <p className="text-sm text-blue-400 mt-1">
                          {positionMap[user.profile.position] || user.profile.position}
                          {user.profile.number && ` #${user.profile.number}`}
                        </p>
                      )}
                    </div>
                    <div className="text-right text-sm">
                      <p className="text-gray-400">Последняя активность</p>
                      <p className="text-white">{getTimeSince(user.lastActivity)}</p>
                    </div>
                  </div>

                  {/* Статистика активности */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                    <div className="bg-[#2d3448] rounded-lg p-3">
                      <p className="text-xs text-gray-400 mb-1">Тренировки</p>
                      <p className="text-lg font-bold">
                        {user.stats.completedSessions}/{user.stats.totalSessions}
                      </p>
                      {user.stats.totalSessions > 0 && (
                        <p className="text-xs text-green-400">
                          {user.stats.completionRate}% завершено
                        </p>
                      )}
                    </div>

                    <div className="bg-[#2d3448] rounded-lg p-3">
                      <p className="text-xs text-gray-400 mb-1">Избранное</p>
                      <p className="text-lg font-bold">{user.stats.favoritesCount}</p>
                    </div>

                    <div className="bg-[#2d3448] rounded-lg p-3">
                      <p className="text-xs text-gray-400 mb-1">Лайки</p>
                      <p className="text-lg font-bold">
                        {user.stats.videoLikesCount + user.stats.shortLikesCount}
                      </p>
                    </div>

                    <div className="bg-[#2d3448] rounded-lg p-3">
                      <p className="text-xs text-gray-400 mb-1">Комментарии</p>
                      <p className="text-lg font-bold">{user.stats.shortCommentsCount}</p>
                    </div>
                  </div>

                  {/* Профиль */}
                  {user.profile && (
                    <div className="flex gap-4 text-sm">
                      {user.profile.age && (
                        <span className="text-gray-400">Возраст: {user.profile.age}</span>
                      )}
                      {user.profile.height && (
                        <span className="text-gray-400">Рост: {user.profile.height} см</span>
                      )}
                      {user.profile.weight && (
                        <span className="text-gray-400">Вес: {user.profile.weight} кг</span>
                      )}
                      {user.profile.overall > 0 && (
                        <span className="text-gray-400">Общий уровень: {user.profile.overall}</span>
                      )}
                    </div>
                  )}

                  {/* Дополнительная информация */}
                  <div className="mt-3 pt-3 border-t border-gray-700 text-xs text-gray-400 flex flex-wrap gap-x-4 gap-y-1">
                    <span>Регистрация: {formatDate(user.createdAt)}</span>
                    {user.email && (
                      <span className={user.emailVerified ? 'text-green-400' : 'text-gray-400'}>
                        Email: {user.email} {user.emailVerified && '✓'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
            );
          })}

          {filteredUsers.length === 0 && (
            <div className="bg-[#1a1f3a] rounded-lg p-8 text-center text-gray-400">
              <p className="text-lg mb-2">Пользователи не найдены</p>
              <p className="text-sm">Попробуйте изменить параметры поиска или фильтры</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
