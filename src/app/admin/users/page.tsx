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
  referralCode?: string | null;
  createdAt: string;
  updatedAt: string;
  lastActivity: string;
  accessTier?: 'FREE' | 'PREMIUM';
  premiumUntil?: string | null;
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
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isDeletingUserId, setIsDeletingUserId] = useState<string | null>(null);

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

  const handleDeleteUser = async (userToDelete: User) => {
    const userLabel = userToDelete.firstName || userToDelete.username || userToDelete.telegramId;
    const confirmed = confirm(`Удалить пользователя "${userLabel}"? Это действие необратимо.`);
    if (!confirmed) return;

    try {
      setIsDeletingUserId(userToDelete.id);
      const response = await fetch(`/api/admin/users?userId=${userToDelete.id}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || 'Ошибка удаления пользователя');
      }

      setUsers(prev => prev.filter(user => user.id !== userToDelete.id));
      if (selectedUser?.id === userToDelete.id) {
        setSelectedUser(null);
      }
    } catch (error) {
      console.error('Error deleting user:', error);
      alert('Ошибка удаления пользователя. Попробуйте снова.');
    } finally {
      setIsDeletingUserId(null);
    }
  };

  // Привязать/сменить email у выбранного пользователя.
  // Нужно, когда Telegram-only аккаунт без настоящего email — он не может войти OTP-ом.
  const handleAttachEmail = async (user: User) => {
    const current = user.email && !user.email.endsWith('@t.me') ? user.email : '';
    const input = window.prompt(
      `Email для пользователя ${user.firstName || user.telegramId}:`,
      current,
    );
    if (input == null) return;
    const email = input.trim().toLowerCase();
    if (!email) return;

    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        alert(data?.error || 'Не удалось привязать email');
        return;
      }
      // Локально обновляем список и выбранного юзера
      setUsers(prev =>
        prev.map(u => (u.id === user.id ? { ...u, email, emailVerified: true } : u)),
      );
      if (selectedUser?.id === user.id) {
        setSelectedUser({ ...selectedUser, email, emailVerified: true });
      }
    } catch (e) {
      console.error('attach email failed', e);
      alert('Сетевая ошибка');
    }
  };

  // Ручная привязка юзера к реф-каналу (напр. подвязать существующего под тренера).
  // Принимает канонический код ИЛИ алиас (в т.ч. кириллицу); пусто — снять привязку.
  const handleSetReferral = async (user: User) => {
    const input = window.prompt(
      `Реф-код канала для ${user.firstName || user.telegramId} (пусто — снять):`,
      user.referralCode || '',
    );
    if (input == null) return;
    const referralCode = input.trim();

    try {
      const res = await fetch(`/api/admin/users/${user.id}/referral`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ referralCode }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        alert(data?.error || 'Не удалось установить реф-код');
        return;
      }
      const nextCode: string | null = data?.referralCode ?? null;
      setUsers(prev => prev.map(u => (u.id === user.id ? { ...u, referralCode: nextCode } : u)));
      if (selectedUser?.id === user.id) {
        setSelectedUser({ ...selectedUser, referralCode: nextCode });
      }
      alert(nextCode ? `Привязан к каналу «${data?.label || nextCode}»` : 'Реф-код снят');
    } catch (e) {
      console.error('set referral failed', e);
      alert('Сетевая ошибка');
    }
  };

  // Выдать / снять премиум-доступ (фундамент под платежи; пока ручной рычаг).
  const handleSetAccess = async (user: User) => {
    const isPremium = user.accessTier === 'PREMIUM';
    let until: string | null = null;
    let note: string | null = null;
    if (isPremium) {
      if (!window.confirm(`Снять PREMIUM у ${user.firstName || user.telegramId}?`)) return;
    } else {
      const untilInput = window.prompt('PREMIUM до (ГГГГ-ММ-ДД). Пусто = бессрочно:', '');
      if (untilInput == null) return; // отмена
      until = untilInput.trim() || null;
      const noteInput = window.prompt('Пометка — за что выдан (необязательно):', '');
      note = noteInput?.trim() || null;
    }
    const tier = isPremium ? 'FREE' : 'PREMIUM';
    try {
      const res = await fetch(`/api/admin/users/${user.id}/access`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier, until, note }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        alert(data?.error || 'Не удалось изменить доступ');
        return;
      }
      const patch = {
        accessTier: data.user.accessTier as 'FREE' | 'PREMIUM',
        premiumUntil: (data.user.premiumUntil ?? null) as string | null,
      };
      setUsers(prev => prev.map(u => (u.id === user.id ? { ...u, ...patch } : u)));
      if (selectedUser?.id === user.id) {
        setSelectedUser({ ...selectedUser, ...patch });
      }
    } catch (e) {
      console.error('set access failed', e);
      alert('Сетевая ошибка');
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
    <div className="min-h-screen bg-[#101530] text-white p-4 md:p-8" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)' }}>
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
              onClick={() => setSelectedUser(user)}
              className={`bg-[#1a1f3a] rounded-lg p-4 hover:bg-[#2d3448] transition-all cursor-pointer ${
                isUpdated ? 'ring-2 ring-green-400 animate-pulse' : ''
              }`}
            >
              <div className="flex items-center justify-between">
                {/* Основная информация */}
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold">
                      {user.firstName || user.username || `User ${user.telegramId.slice(0, 8)}`}
                      {user.lastName && ` ${user.lastName}`}
                    </h3>
                    
                    {isOnlineNow(user.lastActivity) && (
                      <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded-full flex items-center gap-1">
                        <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                        Online
                      </span>
                    )}
                    {user.accessTier === 'PREMIUM' && (
                      <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-1 rounded-full">
                        ⭐ PREMIUM
                      </span>
                    )}
                  </div>
                  
                  <div className="text-sm text-gray-400 space-y-1">
                    <p>ID: {user.telegramId}</p>
                    <p>Регистрация: {formatDate(user.createdAt)}</p>
                    <p>Последняя активность: {getTimeSince(user.lastActivity)}</p>
                  </div>
                </div>

                {/* Статус */}
                <div className="text-right">
                  {isOnlineNow(user.lastActivity) ? (
                    <span className="inline-block px-4 py-2 bg-green-500/20 text-green-400 rounded-lg text-sm font-medium">
                      Онлайн
                    </span>
                  ) : (
                    <span className="inline-block px-4 py-2 bg-gray-700 text-gray-400 rounded-lg text-sm font-medium">
                      Офлайн
                    </span>
                  )}
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

        {/* Модальное окно с детальной информацией */}
        {selectedUser && (
          <div 
            className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedUser(null)}
          >
            <div 
              className="bg-[#1a1f3a] rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Заголовок модального окна */}
              <div className="sticky top-0 bg-[#1a1f3a] border-b border-gray-700 p-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                  <h2 className="text-2xl font-bold flex items-center gap-3 flex-wrap break-words">
                    {selectedUser.firstName || selectedUser.username || `User ${selectedUser.telegramId.slice(0, 8)}`}
                    {selectedUser.lastName && ` ${selectedUser.lastName}`}
                    
                    {isOnlineNow(selectedUser.lastActivity) && (
                      <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded-full flex items-center gap-1">
                        <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                        Online
                      </span>
                    )}
                    
                    {isNewUser(selectedUser.createdAt) && (
                      <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded-full">
                        🆕 Новый
                      </span>
                    )}
                    
                    {selectedUser.pushNotifications.isSubscribed && (
                      <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-1 rounded-full">
                        🔔 Push
                      </span>
                    )}
                  </h2>
                  <p className="text-sm text-gray-400 mt-1">
                    @{selectedUser.username || 'no_username'} • ID: {selectedUser.telegramId}
                  </p>
                  {selectedUser.profile?.position && (
                    <p className="text-sm text-blue-400 mt-1">
                      {positionMap[selectedUser.profile.position] || selectedUser.profile.position}
                      {selectedUser.profile.number && ` #${selectedUser.profile.number}`}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 md:justify-end md:shrink-0">
                  <button
                    onClick={() => handleAttachEmail(selectedUser)}
                    className="px-4 py-2 rounded-lg bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 transition-colors text-sm font-medium"
                    title="Привязать или сменить email — нужно, чтобы пользователь без email мог войти OTP-ом"
                  >
                    {selectedUser.email && !selectedUser.email.endsWith('@t.me')
                      ? 'Сменить email'
                      : 'Привязать email'}
                  </button>
                  <button
                    onClick={() => handleSetAccess(selectedUser)}
                    className={`px-4 py-2 rounded-lg transition-colors text-sm font-medium ${
                      selectedUser.accessTier === 'PREMIUM'
                        ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30'
                        : 'bg-[#A1FF4A]/20 text-[#A1FF4A] hover:bg-[#A1FF4A]/30'
                    }`}
                    title="Ручная выдача/снятие премиум-доступа"
                  >
                    {selectedUser.accessTier === 'PREMIUM' ? 'Снять PREMIUM' : 'Выдать PREMIUM'}
                  </button>
                  <button
                    onClick={() => handleSetReferral(selectedUser)}
                    className="px-4 py-2 rounded-lg bg-purple-600/20 text-purple-300 hover:bg-purple-600/30 transition-colors text-sm font-medium"
                    title="Привязать пользователя к реф-каналу (напр. к тренеру). Принимает код или алиас; пусто — снять."
                  >
                    Реф-код: {selectedUser.referralCode || '—'}
                  </button>
                  <button
                    onClick={() => handleDeleteUser(selectedUser)}
                    disabled={isDeletingUserId === selectedUser.id}
                    className="px-4 py-2 rounded-lg bg-red-600/20 text-red-400 hover:bg-red-600/30 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isDeletingUserId === selectedUser.id ? 'Удаление...' : 'Удалить'}
                  </button>
                  <button
                    onClick={() => setSelectedUser(null)}
                    className="w-10 h-10 rounded-full bg-[#2d3448] hover:bg-[#3a4255] flex items-center justify-center transition-colors"
                  >
                    <span className="text-2xl">×</span>
                  </button>
                </div>
              </div>

              {/* Контент модального окна */}
              <div className="p-6 space-y-6">
                {/* Время активности */}
                <div className="bg-[#2d3448] rounded-lg p-4">
                  <h3 className="text-lg font-semibold mb-3">Активность</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Последняя активность:</span>
                      <span className="text-white">{getTimeSince(selectedUser.lastActivity)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Дата регистрации:</span>
                      <span className="text-white">{formatDate(selectedUser.createdAt)}</span>
                    </div>
                  </div>
                </div>

                {/* Статистика */}
                <div className="bg-[#2d3448] rounded-lg p-4">
                  <h3 className="text-lg font-semibold mb-3">Статистика</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-[#1a1f3a] rounded-lg p-3">
                      <p className="text-xs text-gray-400 mb-1">Тренировки</p>
                      <p className="text-lg font-bold">
                        {selectedUser.stats.completedSessions}/{selectedUser.stats.totalSessions}
                      </p>
                      {selectedUser.stats.totalSessions > 0 && (
                        <p className="text-xs text-green-400">
                          {selectedUser.stats.completionRate}% завершено
                        </p>
                      )}
                    </div>

                    <div className="bg-[#1a1f3a] rounded-lg p-3">
                      <p className="text-xs text-gray-400 mb-1">Избранное</p>
                      <p className="text-lg font-bold">{selectedUser.stats.favoritesCount}</p>
                    </div>

                    <div className="bg-[#1a1f3a] rounded-lg p-3">
                      <p className="text-xs text-gray-400 mb-1">Лайки</p>
                      <p className="text-lg font-bold">
                        {selectedUser.stats.videoLikesCount + selectedUser.stats.shortLikesCount}
                      </p>
                      <p className="text-xs text-gray-400">
                        В: {selectedUser.stats.videoLikesCount} | Ш: {selectedUser.stats.shortLikesCount}
                      </p>
                    </div>

                    <div className="bg-[#1a1f3a] rounded-lg p-3">
                      <p className="text-xs text-gray-400 mb-1">Комментарии</p>
                      <p className="text-lg font-bold">{selectedUser.stats.shortCommentsCount}</p>
                    </div>
                  </div>
                </div>

                {/* Профиль */}
                {selectedUser.profile && (
                  <div className="bg-[#2d3448] rounded-lg p-4">
                    <h3 className="text-lg font-semibold mb-3">Профиль игрока</h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      {selectedUser.profile.age && (
                        <div>
                          <span className="text-gray-400">Возраст:</span>
                          <span className="text-white ml-2">{selectedUser.profile.age} лет</span>
                        </div>
                      )}
                      {selectedUser.profile.height && (
                        <div>
                          <span className="text-gray-400">Рост:</span>
                          <span className="text-white ml-2">{selectedUser.profile.height} см</span>
                        </div>
                      )}
                      {selectedUser.profile.weight && (
                        <div>
                          <span className="text-gray-400">Вес:</span>
                          <span className="text-white ml-2">{selectedUser.profile.weight} кг</span>
                        </div>
                      )}
                      {selectedUser.profile.overall > 0 && (
                        <div>
                          <span className="text-gray-400">Общий уровень:</span>
                          <span className="text-white ml-2">{selectedUser.profile.overall}</span>
                        </div>
                      )}
                      {selectedUser.profile.gender && (
                        <div>
                          <span className="text-gray-400">Пол:</span>
                          <span className="text-white ml-2">
                            {selectedUser.profile.gender === 'MALE' ? 'Мужской' : 'Женский'}
                          </span>
                        </div>
                      )}
                      {selectedUser.profile.dailyProgress !== undefined && (
                        <div>
                          <span className="text-gray-400">Прогресс дня:</span>
                          <span className="text-white ml-2">
                            {selectedUser.profile.dailyProgress}/{selectedUser.profile.maxDailyGoal}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Контактная информация */}
                <div className="bg-[#2d3448] rounded-lg p-4">
                  <h3 className="text-lg font-semibold mb-3">Контакты</h3>
                  <div className="space-y-2 text-sm">
                    {selectedUser.email && (
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400">Email:</span>
                        <span className={selectedUser.emailVerified ? 'text-green-400' : 'text-white'}>
                          {selectedUser.email} {selectedUser.emailVerified && '✓'}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-gray-400">Telegram ID:</span>
                      <span className="text-white font-mono">{selectedUser.telegramId}</span>
                    </div>
                    {selectedUser.pushNotifications.isSubscribed && selectedUser.pushNotifications.subscribedAt && (
                      <div className="flex justify-between">
                        <span className="text-gray-400">Push подписка:</span>
                        <span className="text-purple-400">
                          {formatDate(selectedUser.pushNotifications.subscribedAt)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
