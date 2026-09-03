'use client';

import { POSITION_LABEL } from '@/lib/positions';
import { premiumStatus } from '@/lib/premium-status';
import React, { useState, useEffect } from 'react';
import {
  AdminPage,
  PageHeader,
  SectionTitle,
  AdminCard,
  Kpi,
  AdminButton,
  EmptyState,
  inputStyle,
  labelStyle,
} from '@/components/admin/ui';
import {
  Activity, AlertTriangle, BadgeCheck, BarChart3, Bell, ChevronsUp, Contact,
  Crown, Dumbbell, FilterX, Flame, FlaskConical, Heart, Link2, Loader2, Mail,
  MailCheck, MessageCircle, Radio, RefreshCw, RotateCcw, Search, SearchX, Star,
  Trash2, UserCircle, UserPlus, Users, Wrench, X,
  type LucideIcon,
} from 'lucide-react';

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
  premiumNote?: string | null;
  /** Заказы, по которым выдан премиум (см. /api/admin/users) */
  paidCount?: number;
  firstPaidAt?: string | null;
  lastPaidAt?: string | null;
  isTester?: boolean;
  isAdmin?: boolean;
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

/* ─── Локальные примитивы страницы ─────────────────────────────────────── */

/** Бейдж-статус (Online / Новый / Push / подписка). Всегда одна строка.
 *  warn — янтарный: действующий пробный период. */
const BADGE_TONES = {
  brand: { color: 'var(--color-brand)', bg: 'var(--lime-subtle)', border: 'var(--border-lime)' },
  warn: { color: 'var(--color-danger)', bg: 'rgba(255,140,74,0.12)', border: 'rgba(255,140,74,0.4)' },
  muted: { color: 'var(--color-muted)', bg: 'transparent', border: 'var(--border-hairline)' },
} as const;

function Badge({
  icon: Icon,
  children,
  tone = 'muted',
}: {
  icon?: LucideIcon;
  children: React.ReactNode;
  tone?: keyof typeof BADGE_TONES;
}) {
  const t = BADGE_TONES[tone];
  return (
    <span
      className="inline-flex items-center gap-1 shrink-0 whitespace-nowrap"
      style={{
        fontSize: 12,
        fontWeight: 700,
        padding: '4px 8px',
        borderRadius: 'var(--radius-pill)',
        color: t.color,
        background: t.bg,
        border: `1px solid ${t.border}`,
      }}
    >
      {Icon && <Icon size={16} aria-hidden />}
      {children}
    </span>
  );
}

/** Статус подписки пользователя (платил / пробный / вручную / истёк). */
function subscriptionOf(u: {
  accessTier?: string;
  premiumUntil?: string | null;
  premiumNote?: string | null;
  paidCount?: number;
}) {
  return premiumStatus({
    accessTier: u.accessTier ?? 'FREE',
    premiumUntil: u.premiumUntil ?? null,
    premiumNote: u.premiumNote ?? null,
    paidCount: u.paidCount ?? 0,
  });
}

/** Бейдж подписки: Премиум (лайм) / Пробный период (янтарь) / истёк (серый). */
function SubscriptionBadge({ user }: { user: Parameters<typeof subscriptionOf>[0] }) {
  const s = subscriptionOf(user);
  if (!s.label) return null;
  const tone = s.active ? (s.kind === 'trial' ? 'warn' : 'brand') : 'muted';
  return (
    <Badge icon={Crown} tone={tone}>
      {s.label}
    </Badge>
  );
}

/** Строка «подпись — значение» внутри карточки модалки. */
function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div
      className="flex items-center justify-between gap-4"
      style={{ padding: '8px 0', fontSize: 14 }}
    >
      <span className="shrink-0" style={{ color: 'var(--color-muted)' }}>
        {label}
      </span>
      <span className="min-w-0 text-right truncate">{value}</span>
    </div>
  );
}

/** Включённый тоггл: заливка лаймом, вместо инверсии «вкл = тревожный янтарь». */
const toggleOn = (on: boolean): React.CSSProperties =>
  on
    ? {
        background: 'var(--lime-medium)',
        color: 'var(--color-brand)',
        border: '1px solid var(--border-lime)',
      }
    : {};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [totalStats, setTotalStats] = useState<TotalStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // Ошибка загрузки списка: раньше падение фетча оставляло вечный пустой список.
  const [loadError, setLoadError] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSubscribed, setFilterSubscribed] = useState<boolean | null>(null);
  const [sortBy, setSortBy] = useState<'createdAt' | 'lastActivity' | 'sessions'>('lastActivity');
  const [isLive, setIsLive] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [updatedUserIds, setUpdatedUserIds] = useState<Set<string>>(new Set());
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isDeletingUserId, setIsDeletingUserId] = useState<string | null>(null);
  // Пикер реф-канала (выбор из существующих кодов)
  const [refCodes, setRefCodes] = useState<Array<{ code: string; label: string; isActive: boolean }>>([]);
  const [refPickerUser, setRefPickerUser] = useState<User | null>(null);
  const [refPickerValue, setRefPickerValue] = useState('');
  const [refSaving, setRefSaving] = useState(false);

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

  // Список реф-кодов для выпадающего пикера (один раз).
  useEffect(() => {
    fetch('/api/admin/referrals')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (Array.isArray(d?.codes)) {
          setRefCodes(
            d.codes.map((c: { code: string; label: string; isActive: boolean }) => ({
              code: c.code,
              label: c.label,
              isActive: c.isActive,
            })),
          );
        }
      })
      .catch(() => {});
  }, []);

  // Закрытие модалок по Escape (сначала вложенный пикер, затем карточка юзера).
  useEffect(() => {
    if (!selectedUser && !refPickerUser) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (refPickerUser) {
        if (!refSaving) setRefPickerUser(null);
      } else {
        setSelectedUser(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedUser, refPickerUser, refSaving]);

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

          // Убираем подсветку через 3 секунды
          setTimeout(() => {
            setUpdatedUserIds(new Set());
          }, 3000);
        }
      }
      
      setUsers(data.users || []);
      setTotalStats(data.stats || null);
      setLastUpdate(new Date());
      setLoadError(false);

    } catch (error) {
      console.error('Error fetching users:', error);
      setLoadError(true);
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
  // Открывает пикер с выпадающим списком существующих реф-кодов.
  const handleSetReferral = (user: User) => {
    setRefPickerValue(user.referralCode || '');
    setRefPickerUser(user);
  };

  // Сохранение выбора из пикера. Пусто — снять привязку (null).
  const submitReferral = async () => {
    if (!refPickerUser) return;
    setRefSaving(true);
    try {
      const res = await fetch(`/api/admin/users/${refPickerUser.id}/referral`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ referralCode: refPickerValue }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        alert(data?.error || 'Не удалось установить реф-код');
        return;
      }
      const nextCode: string | null = data?.referralCode ?? null;
      setUsers(prev => prev.map(u => (u.id === refPickerUser.id ? { ...u, referralCode: nextCode } : u)));
      if (selectedUser?.id === refPickerUser.id) {
        setSelectedUser({ ...selectedUser, referralCode: nextCode });
      }
      setRefPickerUser(null);
    } catch (e) {
      console.error('set referral failed', e);
      alert('Сетевая ошибка');
    } finally {
      setRefSaving(false);
    }
  };

  // Выдать / снять премиум-доступ (фундамент под платежи; пока ручной рычаг).
  const handleSetAccess = async (user: User) => {
    // Действующий премиум (с учётом срока): истёкшему предлагаем выдать заново
    const isPremium = subscriptionOf(user).active;
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
        premiumNote: (data.user.premiumNote ?? note ?? null) as string | null,
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

  // Включить / выключить тест-режим (читер-обход лимитов без админ-прав).
  const handleSetTester = async (user: User) => {
    const currentValue = user.isTester === true;
    const action = currentValue ? 'выключить' : 'включить';
    if (!window.confirm(`Тест-режим ${action} у ${user.firstName || user.telegramId}?`)) return;
    try {
      const res = await fetch(`/api/admin/users/${user.id}/tester`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !currentValue }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        alert(data?.error || 'Не удалось изменить тест-режим');
        return;
      }
      const patch = { isTester: data.user.isTester as boolean };
      setUsers(prev => prev.map(u => (u.id === user.id ? { ...u, ...patch } : u)));
      if (selectedUser?.id === user.id) {
        setSelectedUser({ ...selectedUser, ...patch });
      }
    } catch (e) {
      console.error('set tester failed', e);
      alert('Сетевая ошибка');
    }
  };

  // Накрутка геймификации ДЛЯ ТЕСТЕРОВ (собрать стрик/уровень без ожидания дней).
  // XP/уровень/стрик деривируются из синтетических COMPLETED-сессий на бэке.
  // Стрик и уровень взаимоисключающи (оба чистят всю синтетику юзера).
  const handleSeedStreak = async (user: User) => {
    const input = window.prompt('Стрик — сколько дней подряд (1..60)?', '7');
    if (input == null) return;
    const days = parseInt(input, 10);
    if (!Number.isFinite(days) || days < 1) {
      alert('Введите число от 1 до 60');
      return;
    }
    try {
      const res = await fetch(`/api/admin/users/${user.id}/gamification/streak`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        alert(data?.error || 'Не удалось накрутить стрик');
        return;
      }
      alert(`Готово: стрик ${data.streak} дн · уровень ${data.level} · XP ${data.xp}`);
    } catch (e) {
      console.error('seed streak failed', e);
      alert('Сетевая ошибка');
    }
  };

  const handleSeedLevel = async (user: User) => {
    const input = window.prompt('Уровень (1..60)?', '10');
    if (input == null) return;
    const level = parseInt(input, 10);
    if (!Number.isFinite(level) || level < 1) {
      alert('Введите число от 1 до 60');
      return;
    }
    try {
      const res = await fetch(`/api/admin/users/${user.id}/gamification/level`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        alert(data?.error || 'Не удалось накрутить уровень');
        return;
      }
      alert(`Готово: уровень ${data.level} · XP ${data.xp} · стрик ${data.streak} дн`);
    } catch (e) {
      console.error('seed level failed', e);
      alert('Сетевая ошибка');
    }
  };

  const handleResetLimits = async (user: User) => {
    if (!window.confirm(`Сбросить дневные лимиты у ${user.firstName || user.telegramId}?`)) return;
    try {
      const res = await fetch(`/api/admin/users/${user.id}/gamification/reset-limits`, {
        method: 'POST',
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        alert(data?.error || 'Не удалось сбросить лимиты');
        return;
      }
      alert('Дневные лимиты сброшены');
    } catch (e) {
      console.error('reset limits failed', e);
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

  const positionMap: Record<string, string> = POSITION_LABEL;

  // Плейсхолдер загрузки повторяет геометрию реального экрана (4 KPI + 5 строк),
  // чтобы после отрисовки данных не было прыжка вёрстки.
  if (isLoading) {
    return (
      <AdminPage>
        <PageHeader title="Пользователи" icon={Users} subtitle="Загружаю…" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="animate-pulse"
              style={{
                height: 96,
                borderRadius: 'var(--radius-md)',
                background: 'var(--color-surface)',
                border: '1px solid var(--border-hairline)',
              }}
            />
          ))}
        </div>
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="animate-pulse"
              style={{
                height: 108,
                borderRadius: 'var(--radius-md)',
                background: 'var(--color-surface)',
                border: '1px solid var(--border-hairline)',
              }}
            />
          ))}
        </div>
      </AdminPage>
    );
  }

  return (
    <AdminPage>
      <PageHeader
        title="Пользователи"
        icon={Users}
        subtitle={`Обновлено в ${lastUpdate.toLocaleTimeString('ru-RU')}`}
        actions={
          <>
            <AdminButton
              tone="secondary"
              onClick={() => fetchUsers(false)}
              disabled={isLoading}
              aria-label="Обновить список"
              title="Обновить вручную"
              style={{ width: 44, padding: 0 }}
            >
              <RefreshCw size={20} className={isLoading ? 'animate-spin' : ''} aria-hidden />
            </AdminButton>

            {/* Фиксированная ширина: раньше при LIVE→OFF шапка дёргалась */}
            <AdminButton
              tone="secondary"
              onClick={() => setIsLive(!isLive)}
              aria-pressed={isLive}
              title={isLive ? 'Автообновление включено' : 'Автообновление выключено'}
              style={{ minWidth: 104, ...toggleOn(isLive) }}
            >
              <Radio size={20} aria-hidden />
              {isLive ? 'LIVE' : 'OFF'}
            </AdminButton>
          </>
        }
      />

      {loadError && (
        <div className="mb-6">
          <AdminCard tone="danger">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <AlertTriangle size={20} style={{ color: 'var(--color-danger)' }} aria-hidden />
                <span style={{ fontSize: 14 }}>Не удалось загрузить список пользователей.</span>
              </div>
              <AdminButton tone="secondary" size="sm" icon={RefreshCw} onClick={() => fetchUsers(false)}>
                Повторить
              </AdminButton>
            </div>
          </AdminCard>
        </div>
      )}

      {/* ───────── Общая статистика ───────── */}
      {totalStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <Kpi icon={Users} label="Всего" value={totalStats.totalUsers} />
          <Kpi
            icon={Activity}
            label="Активных"
            value={totalStats.activeUsers}
            accent={totalStats.activeUsers > 0}
          />
          <Kpi icon={Bell} label="Подписаны на push" value={totalStats.subscribedUsers} />
          <Kpi icon={MailCheck} label="Email подтверждён" value={totalStats.verifiedEmails} />
        </div>
      )}

      {/* ───────── Фильтры и поиск ───────── */}
      <AdminCard className="mb-6">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search
              size={16}
              aria-hidden
              style={{
                position: 'absolute',
                left: 14,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--color-muted)',
                pointerEvents: 'none',
              }}
            />
            <input
              type="text"
              placeholder="Поиск по имени, username, Telegram ID…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ ...inputStyle, padding: '10px 44px' }}
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                aria-label="Очистить поиск"
                className="inline-flex items-center justify-center"
                style={{
                  position: 'absolute',
                  right: 2,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: 40,
                  height: 40,
                  borderRadius: 'var(--radius-pill)',
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--color-muted)',
                  cursor: 'pointer',
                }}
              >
                <X size={16} aria-hidden />
              </button>
            )}
          </div>

          <select
            aria-label="Фильтр по подписке на push"
            value={filterSubscribed === null ? 'all' : filterSubscribed.toString()}
            onChange={(e) => setFilterSubscribed(
              e.target.value === 'all' ? null : e.target.value === 'true'
            )}
            style={{ ...inputStyle, width: 'auto', minWidth: 200 }}
          >
            <option value="all">Все подписки</option>
            <option value="true">Подписаны на push</option>
            <option value="false">Не подписаны</option>
          </select>

          <select
            aria-label="Сортировка"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            style={{ ...inputStyle, width: 'auto', minWidth: 200 }}
          >
            <option value="lastActivity">По активности</option>
            <option value="createdAt">По дате регистрации</option>
            <option value="sessions">По тренировкам</option>
          </select>
        </div>

        <div style={{ marginTop: 12, fontSize: 13, color: 'var(--color-muted)' }}>
          Найдено: {filteredUsers.length} из {users.length}
        </div>
      </AdminCard>

      {/* ───────── Список пользователей ───────── */}
      <div className="space-y-3">
        {filteredUsers.map((user) => {
          const isUpdated = updatedUserIds.has(user.id);
          const online = isOnlineNow(user.lastActivity);

          return (
            <button
              key={user.id}
              type="button"
              onClick={() => setSelectedUser(user)}
              className="block w-full text-left transition-colors hover:brightness-125"
              style={{
                padding: 16,
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                // Обновлённая строка: статичная лаймовая рамка вместо мигания всей карточки
                background: isUpdated ? 'var(--lime-subtle)' : 'var(--color-surface)',
                border: `1px solid ${isUpdated ? 'var(--border-lime)' : 'var(--border-hairline)'}`,
              }}
            >
              {/* Внутри <button> — только phrasing-контент (span), иначе невалидная вёрстка */}
              <span className="flex items-start justify-between gap-4">
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2" style={{ marginBottom: 8 }}>
                    {online && (
                      <span
                        aria-hidden
                        className="shrink-0"
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 'var(--radius-pill)',
                          background: 'var(--color-brand)',
                        }}
                      />
                    )}
                    <span style={{ fontSize: 16, fontWeight: 700 }}>
                      {user.firstName || user.username || `User ${user.telegramId.slice(0, 8)}`}
                      {user.lastName && ` ${user.lastName}`}
                    </span>
                    <SubscriptionBadge user={user} />
                  </span>

                  <span
                    className="block"
                    style={{ fontSize: 13, color: 'var(--color-muted)', lineHeight: 1.6 }}
                  >
                    <span className="block">ID: {user.telegramId}</span>
                    <span className="block">Регистрация: {formatDate(user.createdAt)}</span>
                  </span>
                </span>

                {/* Одна индикация статуса вместо двух: чип + пилюля */}
                <span
                  className="shrink-0 text-right"
                  style={{ fontSize: 12, color: online ? 'var(--color-brand)' : 'var(--color-muted)' }}
                >
                  {online ? 'Онлайн' : getTimeSince(user.lastActivity)}
                </span>
              </span>
            </button>
          );
        })}

        {filteredUsers.length === 0 && (
          <AdminCard>
            {users.length === 0 ? (
              <EmptyState
                icon={Users}
                title="Пользователей пока нет"
                hint="Как только кто-то зарегистрируется — он появится здесь"
              />
            ) : (
              <>
                <EmptyState
                  icon={SearchX}
                  title="Под фильтры никто не попал"
                  hint={`Всего пользователей: ${users.length}`}
                />
                <div className="flex justify-center">
                  <AdminButton
                    tone="secondary"
                    icon={FilterX}
                    onClick={() => {
                      setSearchTerm('');
                      setFilterSubscribed(null);
                    }}
                  >
                    Сбросить фильтры
                  </AdminButton>
                </div>
              </>
            )}
          </AdminCard>
        )}
      </div>

      {/* ───────── Модалка: карточка пользователя ───────── */}
      {selectedUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'var(--scrim)' }}
          onClick={() => setSelectedUser(null)}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Карточка пользователя"
            className="w-full max-w-3xl max-h-[90vh] overflow-y-auto"
            style={{
              background: 'var(--color-elevated)',
              border: '1px solid var(--border-hairline)',
              borderRadius: 'var(--radius-xl)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Шапка: имя + кнопка «Закрыть». Бейджи вынесены отдельной строкой,
                чтобы заголовок не переносился и высота шапки не скакала. */}
            <div
              className="sticky top-0 z-10"
              style={{
                background: 'var(--color-elevated)',
                borderBottom: '1px solid var(--border-hairline)',
                padding: 24,
              }}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0 }} className="truncate">
                    {selectedUser.firstName || selectedUser.username || `User ${selectedUser.telegramId.slice(0, 8)}`}
                    {selectedUser.lastName && ` ${selectedUser.lastName}`}
                  </h2>
                  <p style={{ fontSize: 13, color: 'var(--color-muted)', margin: '4px 0 0' }}>
                    @{selectedUser.username || 'no_username'} • ID: {selectedUser.telegramId}
                  </p>
                  {selectedUser.profile?.position && (
                    <p style={{ fontSize: 13, color: 'var(--color-brand)', margin: '4px 0 0' }}>
                      {positionMap[selectedUser.profile.position] || selectedUser.profile.position}
                      {selectedUser.profile.number && ` #${selectedUser.profile.number}`}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-2" style={{ marginTop: 12 }}>
                    {isOnlineNow(selectedUser.lastActivity) && (
                      <Badge icon={Activity} tone="brand">Online</Badge>
                    )}
                    {isNewUser(selectedUser.createdAt) && <Badge icon={UserPlus}>Новый</Badge>}
                    {selectedUser.pushNotifications.isSubscribed && <Badge icon={Bell}>Push</Badge>}
                    <SubscriptionBadge user={selectedUser} />
                  </div>
                </div>

                <AdminButton
                  tone="secondary"
                  onClick={() => setSelectedUser(null)}
                  aria-label="Закрыть"
                  style={{ width: 44, padding: 0, flexShrink: 0 }}
                >
                  <X size={20} aria-hidden />
                </AdminButton>
              </div>
            </div>

            {/* Тело модалки */}
            <div className="space-y-6" style={{ padding: 24 }}>
              {/* ─── Действия: три группы вместо «стены кнопок» ─── */}
              <div>
                <SectionTitle icon={Wrench}>Действия</SectionTitle>
                <AdminCard>
                  <div className="flex flex-wrap gap-2">
                    <AdminButton
                      tone="secondary"
                      size="sm"
                      icon={Mail}
                      onClick={() => handleAttachEmail(selectedUser)}
                      title="Привязать или сменить email — нужно, чтобы пользователь без email мог войти OTP-ом"
                    >
                      {selectedUser.email && !selectedUser.email.endsWith('@t.me')
                        ? 'Сменить email'
                        : 'Привязать email'}
                    </AdminButton>

                    {/* Вкл = лайм, выкл = ghost (раньше семантика цвета была инвертирована) */}
                    <AdminButton
                      tone="secondary"
                      size="sm"
                      icon={Crown}
                      aria-pressed={subscriptionOf(selectedUser).active}
                      style={toggleOn(subscriptionOf(selectedUser).active)}
                      onClick={() => handleSetAccess(selectedUser)}
                      title="Ручная выдача/снятие премиум-доступа"
                    >
                      {subscriptionOf(selectedUser).active
                        ? 'Снять PREMIUM'
                        : subscriptionOf(selectedUser).expired
                          ? 'Продлить PREMIUM'
                          : 'Выдать PREMIUM'}
                    </AdminButton>

                    {/* Состояние — через aria-pressed и заливку, а не глифами ✓/✗ */}
                    <AdminButton
                      tone="secondary"
                      size="sm"
                      icon={FlaskConical}
                      aria-pressed={selectedUser.isTester === true}
                      style={toggleOn(selectedUser.isTester === true)}
                      onClick={() => handleSetTester(selectedUser)}
                      title="Тест-режим: читер-обход дневного лимита модулей и начисление XP на свободном просмотре (без админ-прав)"
                    >
                      Тест-режим
                    </AdminButton>
                  </div>

                  {(selectedUser.isTester || selectedUser.isAdmin) && (
                    <div style={{ borderTop: '1px solid var(--border-hairline)', marginTop: 16, paddingTop: 16 }}>
                      <div style={{ fontSize: 12, color: 'var(--color-muted)', marginBottom: 8 }}>
                        Тест-инструменты
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <AdminButton
                          tone="secondary"
                          size="sm"
                          icon={Flame}
                          onClick={() => handleSeedStreak(selectedUser)}
                          title="Накрутить стрик N дней (синтетические сессии, только для тест-аккаунтов)"
                        >
                          Накрутить стрик
                        </AdminButton>
                        <AdminButton
                          tone="secondary"
                          size="sm"
                          icon={ChevronsUp}
                          onClick={() => handleSeedLevel(selectedUser)}
                          title="Накрутить уровень N (синтетические сессии, только для тест-аккаунтов)"
                        >
                          Накрутить уровень
                        </AdminButton>
                        <AdminButton
                          tone="secondary"
                          size="sm"
                          icon={RotateCcw}
                          onClick={() => handleResetLimits(selectedUser)}
                          title="Сбросить дневные лимиты (модули/тренировки/генерация)"
                        >
                          Сброс лимитов
                        </AdminButton>
                      </div>
                    </div>
                  )}

                  <div style={{ borderTop: '1px solid var(--border-hairline)', marginTop: 16, paddingTop: 16 }}>
                    <AdminButton
                      tone="danger"
                      size="sm"
                      disabled={isDeletingUserId === selectedUser.id}
                      onClick={() => handleDeleteUser(selectedUser)}
                      title="Необратимо удалить аккаунт и все его данные"
                    >
                      {isDeletingUserId === selectedUser.id ? (
                        <Loader2 size={16} className="animate-spin" aria-hidden />
                      ) : (
                        <Trash2 size={16} aria-hidden />
                      )}
                      {isDeletingUserId === selectedUser.id ? 'Удаление…' : 'Удалить пользователя'}
                    </AdminButton>
                  </div>
                </AdminCard>
              </div>

              {/* ─── Активность ─── */}
              <div>
                <SectionTitle icon={Activity}>Активность</SectionTitle>
                <AdminCard>
                  <Row label="Последняя активность" value={getTimeSince(selectedUser.lastActivity)} />
                  {/* Подписка: кто платил, когда оформил, до какого числа
                      (правка владельца «Начало сентября») */}
                  {(() => {
                    const s = subscriptionOf(selectedUser);
                    if (s.kind === 'none' && !selectedUser.premiumUntil) return null;
                    return (
                      <>
                        <Row label="Подписка" value={s.label ?? '—'} />
                        {selectedUser.firstPaidAt && (
                          <Row
                            label="Оформил"
                            value={`${formatDate(selectedUser.firstPaidAt)} · оплат: ${selectedUser.paidCount ?? 0}`}
                          />
                        )}
                        {selectedUser.lastPaidAt && selectedUser.lastPaidAt !== selectedUser.firstPaidAt && (
                          <Row label="Последняя оплата" value={formatDate(selectedUser.lastPaidAt)} />
                        )}
                        <Row
                          label={s.expired ? 'Истёк' : 'Действует до'}
                          value={selectedUser.premiumUntil ? formatDate(selectedUser.premiumUntil) : 'бессрочно'}
                        />
                        {selectedUser.premiumNote && <Row label="Пометка" value={selectedUser.premiumNote} />}
                      </>
                    );
                  })()}
                  <Row label="Дата регистрации" value={formatDate(selectedUser.createdAt)} />
                </AdminCard>
              </div>

              {/* ─── Статистика ─── */}
              <div>
                <SectionTitle icon={BarChart3}>Статистика</SectionTitle>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Kpi
                    icon={Dumbbell}
                    label="Тренировки"
                    value={`${selectedUser.stats.completedSessions}/${selectedUser.stats.totalSessions}`}
                    hint={
                      selectedUser.stats.totalSessions > 0
                        ? `${selectedUser.stats.completionRate}% завершено`
                        : undefined
                    }
                  />
                  <Kpi icon={Star} label="Избранное" value={selectedUser.stats.favoritesCount} />
                  <Kpi
                    icon={Heart}
                    label="Лайки"
                    value={selectedUser.stats.videoLikesCount + selectedUser.stats.shortLikesCount}
                    hint={`Видео ${selectedUser.stats.videoLikesCount} · Шортсы ${selectedUser.stats.shortLikesCount}`}
                  />
                  <Kpi
                    icon={MessageCircle}
                    label="Комментарии"
                    value={selectedUser.stats.shortCommentsCount}
                  />
                </div>
              </div>

              {/* ─── Профиль игрока ─── */}
              {selectedUser.profile && (
                <div>
                  <SectionTitle icon={UserCircle}>Профиль игрока</SectionTitle>
                  <AdminCard>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
                      {selectedUser.profile.age && (
                        <Row label="Возраст" value={`${selectedUser.profile.age} лет`} />
                      )}
                      {selectedUser.profile.height && (
                        <Row label="Рост" value={`${selectedUser.profile.height} см`} />
                      )}
                      {selectedUser.profile.weight && (
                        <Row label="Вес" value={`${selectedUser.profile.weight} кг`} />
                      )}
                      {selectedUser.profile.overall > 0 && (
                        <Row label="Общий уровень" value={selectedUser.profile.overall} />
                      )}
                      {selectedUser.profile.gender && (
                        <Row
                          label="Пол"
                          value={selectedUser.profile.gender === 'MALE' ? 'Мужской' : 'Женский'}
                        />
                      )}
                      {selectedUser.profile.dailyProgress !== undefined && (
                        <Row
                          label="Прогресс дня"
                          value={`${selectedUser.profile.dailyProgress}/${selectedUser.profile.maxDailyGoal}`}
                        />
                      )}
                    </div>
                  </AdminCard>
                </div>
              )}

              {/* ─── Контакты ─── */}
              <div>
                <SectionTitle icon={Contact}>Контакты</SectionTitle>
                <AdminCard>
                  {selectedUser.email && (
                    <Row
                      label="Email"
                      value={
                        <span className="inline-flex items-center gap-1">
                          <span className="truncate">{selectedUser.email}</span>
                          {selectedUser.emailVerified && (
                            <BadgeCheck
                              size={16}
                              className="shrink-0"
                              style={{ color: 'var(--color-brand)' }}
                              aria-label="Email подтверждён"
                            />
                          )}
                        </span>
                      }
                    />
                  )}
                  <Row
                    label="Telegram ID"
                    value={<span className="font-mono">{selectedUser.telegramId}</span>}
                  />
                  {/* Реф-код показан значением, а не в лейбле кнопки — ряд действий
                      больше не перекладывается при смене длины кода. */}
                  <div
                    className="flex items-center justify-between gap-4"
                    style={{ padding: '8px 0', fontSize: 14 }}
                  >
                    <span className="shrink-0" style={{ color: 'var(--color-muted)' }}>
                      Реф-канал
                    </span>
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="truncate">{selectedUser.referralCode || '—'}</span>
                      <AdminButton
                        tone="secondary"
                        size="sm"
                        onClick={() => handleSetReferral(selectedUser)}
                        aria-label="Изменить реф-канал"
                        title="Привязать пользователя к реф-каналу (напр. к тренеру); пусто — снять."
                        style={{ width: 44, minHeight: 44, padding: 0, flexShrink: 0 }}
                      >
                        <Link2 size={16} aria-hidden />
                      </AdminButton>
                    </span>
                  </div>
                  {selectedUser.pushNotifications.isSubscribed && selectedUser.pushNotifications.subscribedAt && (
                    <Row
                      label="Push подписка"
                      value={formatDate(selectedUser.pushNotifications.subscribedAt)}
                    />
                  )}
                </AdminCard>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ───────── Пикер реф-канала (вложенная модалка) ───────── */}
      {refPickerUser && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center p-4"
          style={{ background: 'var(--scrim)' }}
          onClick={() => !refSaving && setRefPickerUser(null)}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Реф-канал"
            className="w-full max-w-sm"
            style={{
              background: 'var(--color-elevated)',
              border: '1px solid var(--border-hairline)',
              borderRadius: 'var(--radius-xl)',
              padding: 24,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>Реф-канал</h3>
            <p
              className="truncate"
              style={{ fontSize: 13, color: 'var(--color-muted)', margin: '4px 0 16px' }}
            >
              {refPickerUser.firstName || refPickerUser.email || refPickerUser.telegramId}
            </p>

            <label htmlFor="ref-picker-select" style={labelStyle}>
              Канал привлечения
            </label>
            <select
              id="ref-picker-select"
              value={refPickerValue}
              onChange={(e) => setRefPickerValue(e.target.value)}
              disabled={refSaving}
              style={{ ...inputStyle, marginBottom: 16 }}
            >
              <option value="">— без канала —</option>
              {refCodes.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label} ({c.code}){c.isActive ? '' : ' · неактивен'}
                </option>
              ))}
            </select>

            <div className="flex justify-end gap-2">
              <AdminButton
                tone="secondary"
                size="sm"
                onClick={() => setRefPickerUser(null)}
                disabled={refSaving}
              >
                Отмена
              </AdminButton>
              <AdminButton tone="primary" size="sm" onClick={submitReferral} disabled={refSaving}>
                {refSaving && <Loader2 size={16} className="animate-spin" aria-hidden />}
                {refSaving ? 'Сохраняю…' : 'Сохранить'}
              </AdminButton>
            </div>
          </div>
        </div>
      )}
    </AdminPage>
  );
}
