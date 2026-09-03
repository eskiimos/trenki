'use client';

import { POSITION_LABEL } from '@/lib/positions';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  AdminPage,
  PageHeader,
  SectionTitle,
  AdminCard,
  Kpi,
  AdminButton,
  EmptyState,
} from '@/components/admin/ui';
import {
  Activity, AlertTriangle, BarChart3, ChevronRight, Dumbbell, Eye, Film, Gauge,
  Heart, LineChart, MessageSquare, Pause, PieChart, RefreshCw, Star, Trophy,
  UserPlus, Users, Video,
} from 'lucide-react';

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

/* ─── Локальные примитивы страницы ─────────────────────────────────────── */

/** Строка «подпись — значение» внутри карточки. */
function StatRow({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: React.ReactNode;
  tone?: 'default' | 'brand' | 'danger' | 'muted';
}) {
  const COLOR: Record<string, string> = {
    default: 'var(--color-ink)',
    brand: 'var(--color-brand)',
    danger: 'var(--color-danger)',
    muted: 'var(--color-muted)',
  };
  return (
    <div className="flex items-center justify-between gap-4" style={{ fontSize: 14 }}>
      <span style={{ color: 'var(--color-muted)' }}>{label}</span>
      <span style={{ fontWeight: 700, color: COLOR[tone] }}>{value}</span>
    </div>
  );
}

/**
 * Столбчатая диаграмма. Высота бара — в процентах от контейнера (раньше были
 * магические множители height*2 / height*1.5 в боксах 256/192px), hover-зона —
 * вся колонка (раньше при count = 0 бар имел нулевую высоту и тултип был
 * недостижим), подписи — каждая N-я без поворота.
 */
function BarChart({
  data,
  color,
  unit,
  height = 224,
  labelEvery = 1,
}: {
  data: Array<{ label: string; value: number }>;
  color: string;
  unit: string;
  height?: number;
  labelEvery?: number;
}) {
  if (data.length === 0) {
    return <EmptyState icon={LineChart} title="Пока нет данных" />;
  }
  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className="overflow-x-auto">
      <div style={{ minWidth: data.length * 20 }}>
        <div className="flex items-end gap-1" style={{ height }}>
          {data.map((d, i) => (
            <div
              key={i}
              className="group flex h-full flex-1 items-end"
              style={{ minWidth: 12 }}
            >
              <div
                className="relative w-full transition-opacity group-hover:opacity-80"
                style={{
                  height: `${(d.value / max) * 100}%`,
                  minHeight: 2,
                  background: color,
                  borderRadius: '4px 4px 0 0',
                }}
              >
                <span
                  className="pointer-events-none absolute left-1/2 -translate-x-1/2 whitespace-nowrap opacity-0 transition-opacity group-hover:opacity-100"
                  style={{
                    bottom: '100%',
                    marginBottom: 4,
                    padding: '4px 8px',
                    fontSize: 12,
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--color-night)',
                    border: '1px solid var(--border-hairline)',
                    color: 'var(--color-ink)',
                  }}
                >
                  {d.label}: {d.value} {unit}
                </span>
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-1" style={{ marginTop: 8 }}>
          {data.map((d, i) => (
            <div
              key={i}
              className="flex-1 truncate text-center"
              style={{ minWidth: 12, fontSize: 11, color: 'var(--color-muted)' }}
            >
              {i % labelEvery === 0 ? d.label : ''}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Строка ТОП-контента: ранг-тайл + название + просмотры/лайки с подписями. */
function TopRow({
  rank,
  title,
  views,
  likes,
}: {
  rank: number;
  title: string;
  views: number;
  likes: number;
}) {
  return (
    <div
      className="flex items-center gap-3"
      style={{
        padding: 12,
        borderRadius: 'var(--radius-sm)',
        background: 'var(--color-night)',
        border: '1px solid var(--border-hairline)',
      }}
    >
      <span
        className="flex shrink-0 items-center justify-center"
        style={{
          width: 40,
          height: 40,
          borderRadius: 'var(--radius-pill)',
          background: 'var(--lime-subtle)',
          color: 'var(--color-brand)',
          fontSize: 14,
          fontWeight: 800,
        }}
      >
        {rank}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate" style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>
          {title}
        </p>
        <div
          className="flex items-center gap-4"
          style={{ marginTop: 4, fontSize: 12, color: 'var(--color-muted)' }}
        >
          <span className="inline-flex items-center gap-1" title="Просмотры">
            <Eye size={16} aria-hidden />
            {views.toLocaleString('ru-RU')}
            <span className="sr-only">просмотров</span>
          </span>
          <span className="inline-flex items-center gap-1" title="Лайки">
            <Heart size={16} aria-hidden />
            {likes.toLocaleString('ru-RU')}
            <span className="sr-only">лайков</span>
          </span>
        </div>
      </div>
    </div>
  );
}

export default function AdminStatsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // Ошибка загрузки: раньше при упавшем фетче страница отдавала пустой экран
  // (`if (!stats) return null`) без единого слова.
  const [loadError, setLoadError] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'content' | 'training' | 'distributions' | 'charts' | 'top' | 'recent'>('overview');

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
      setLoadError(false);
    } catch (error) {
      console.error('Error fetching stats:', error);
      setLoadError(true);
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

  const positionNames: Record<string, string> = POSITION_LABEL;

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

  const tabs = [
    { id: 'overview' as const, label: 'Ключевые' },
    { id: 'users' as const, label: 'Пользователи' },
    { id: 'content' as const, label: 'Контент' },
    { id: 'training' as const, label: 'Тренировки' },
    { id: 'distributions' as const, label: 'Распределения' },
    { id: 'charts' as const, label: 'Графики' },
    { id: 'top' as const, label: 'ТОП' },
    { id: 'recent' as const, label: 'Новые' },
  ];

  // Плейсхолдер повторяет реальный лейаут (шапка + 4 KPI), чтобы после загрузки
  // не было прыжка вёрстки.
  if (isLoading) {
    return (
      <AdminPage>
        <PageHeader title="Аналитика" icon={BarChart3} subtitle="Загружаю…" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
      </AdminPage>
    );
  }

  if (!stats) {
    return (
      <AdminPage>
        <PageHeader title="Аналитика" icon={BarChart3} />
        <AdminCard tone="danger">
          <EmptyState
            icon={AlertTriangle}
            tone="danger"
            title={loadError ? 'Не удалось загрузить статистику' : 'Данных нет'}
            hint={loadError ? 'Проверьте соединение и попробуйте ещё раз' : undefined}
          />
          <div className="flex justify-center">
            <AdminButton tone="secondary" icon={RefreshCw} onClick={fetchStats}>
              Повторить
            </AdminButton>
          </div>
        </AdminCard>
      </AdminPage>
    );
  }

  return (
    <AdminPage>
      <PageHeader
        title="Аналитика"
        icon={BarChart3}
        subtitle={`Обновлено: ${formatTime(stats.generatedAt)}`}
        actions={
          // Фиксированная ширина: раньше лейбл «Авто»↔«Пауза» дёргал шапку
          <AdminButton
            tone="secondary"
            onClick={() => setAutoRefresh(!autoRefresh)}
            aria-pressed={autoRefresh}
            title={autoRefresh ? 'Автообновление включено' : 'Автообновление на паузе'}
            style={{
              minWidth: 128,
              ...(autoRefresh
                ? {
                    background: 'var(--lime-medium)',
                    color: 'var(--color-brand)',
                    border: '1px solid var(--border-lime)',
                  }
                : {}),
            }}
          >
            {autoRefresh ? <RefreshCw size={20} aria-hidden /> : <Pause size={20} aria-hidden />}
            {autoRefresh ? 'Авто' : 'Пауза'}
          </AdminButton>
        }
      />

      {loadError && (
        <div className="mb-6">
          <AdminCard tone="danger">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <AlertTriangle size={20} style={{ color: 'var(--color-danger)' }} aria-hidden />
                <span style={{ fontSize: 14 }}>
                  Последнее обновление не прошло — показаны данные с прошлого запроса.
                </span>
              </div>
              <AdminButton tone="secondary" size="sm" icon={RefreshCw} onClick={fetchStats}>
                Повторить
              </AdminButton>
            </div>
          </AdminCard>
        </div>
      )}

      {/* ───────── Вкладки: горизонтальный скролл вместо трёх строк ───────── */}
      <div className="mb-6 overflow-x-auto">
        <div className="flex gap-2" style={{ whiteSpace: 'nowrap' }}>
          {tabs.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                aria-pressed={active}
                className="shrink-0 transition-colors"
                style={{
                  minHeight: 40,
                  padding: '8px 16px',
                  borderRadius: 'var(--radius-pill)',
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: active ? 'var(--color-brand)' : 'var(--color-surface)',
                  color: active ? 'var(--color-night)' : 'var(--color-muted)',
                  border: `1px solid ${active ? 'var(--color-brand)' : 'var(--border-hairline)'}`,
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ───────── Ключевые показатели ───────── */}
      {activeTab === 'overview' && (
        <div className="mb-8">
          <SectionTitle icon={Gauge}>Ключевые показатели</SectionTitle>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <Kpi
              icon={Users}
              label="Всего пользователей"
              value={stats.users.total}
              hint={`Сегодня: +${stats.users.today}`}
            />
            <Kpi
              icon={Activity}
              label="Онлайн сейчас"
              value={stats.activity.onlineNow}
              hint={`DAU: ${stats.activity.dauRate}%`}
              accent={stats.activity.onlineNow > 0}
            />
            <Kpi
              icon={Dumbbell}
              label="Тренировок"
              value={stats.training.total}
              hint={`Завершено: ${stats.training.completionRate}%`}
            />
            <Kpi
              icon={Video}
              label="Видео контент"
              value={stats.content.videos.published}
              hint={`Просмотров: ${stats.content.videos.views.toLocaleString('ru-RU')}`}
            />
          </div>
        </div>
      )}

      {/* ───────── Пользователи ───────── */}
      {activeTab === 'users' && (
        <div className="mb-8">
          <SectionTitle icon={Users}>Пользователи</SectionTitle>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <AdminCard>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 16px' }}>Регистрации</h3>
              <div className="space-y-2">
                <StatRow label="Сегодня" value={stats.users.today} tone="brand" />
                <StatRow label="Вчера" value={stats.users.yesterday} />
                <StatRow label="За неделю" value={stats.users.thisWeek} />
                <StatRow label="За месяц" value={stats.users.thisMonth} />
              </div>
              <div style={{ borderTop: '1px solid var(--border-hairline)', marginTop: 16, paddingTop: 16 }}>
                <StatRow
                  label="Рост"
                  tone={parseFloat(stats.users.growth) > 0 ? 'brand' : 'danger'}
                  value={`${parseFloat(stats.users.growth) > 0 ? '+' : ''}${stats.users.growth}%`}
                />
              </div>
            </AdminCard>

            <AdminCard>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 16px' }}>Активность</h3>
              <div className="space-y-2">
                <StatRow label="Активны сегодня" value={stats.activity.activeToday} tone="brand" />
                <StatRow label="Активны за неделю" value={stats.activity.activeThisWeek} />
                <StatRow label="Активны за месяц" value={stats.activity.activeThisMonth} />
              </div>
              <div
                className="space-y-2"
                style={{ borderTop: '1px solid var(--border-hairline)', marginTop: 16, paddingTop: 16 }}
              >
                <StatRow label="DAU" value={`${stats.activity.dauRate}%`} />
                <StatRow label="WAU" value={`${stats.activity.wauRate}%`} />
                <StatRow label="MAU" value={`${stats.activity.mauRate}%`} />
              </div>
            </AdminCard>

            <AdminCard>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 16px' }}>Вовлеченность</h3>
              {/* Группы по 2 строки: 8 внутри группы, 16 между группами */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <StatRow label="Email подтверждён" value={stats.engagement.verifiedEmails} />
                  <StatRow
                    label="Конверсия"
                    value={`${stats.engagement.emailVerificationRate}%`}
                    tone="brand"
                  />
                </div>
                <div className="space-y-2">
                  <StatRow label="Push подписки" value={stats.engagement.pushSubscriptions} />
                  <StatRow
                    label="Конверсия"
                    value={`${stats.engagement.pushSubscriptionRate}%`}
                    tone="brand"
                  />
                </div>
                <div className="space-y-2">
                  <StatRow label="Заполненные профили" value={stats.engagement.profilesWithPosition} />
                  <StatRow
                    label="Конверсия"
                    value={`${stats.engagement.profileCompletionRate}%`}
                    tone="brand"
                  />
                </div>
              </div>
            </AdminCard>
          </div>
        </div>
      )}

      {/* ───────── Контент ───────── */}
      {activeTab === 'content' && (
        <div className="mb-8">
          <SectionTitle icon={Film}>Контент</SectionTitle>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <AdminCard>
              <h3 className="flex items-center gap-2" style={{ fontSize: 16, fontWeight: 700, margin: '0 0 12px' }}>
                <Video size={20} style={{ color: 'var(--color-muted)' }} aria-hidden />
                Видео
              </h3>
              <div className="space-y-2">
                <StatRow label="Всего" value={stats.content.videos.total} />
                <StatRow label="Опубликовано" value={stats.content.videos.published} tone="brand" />
                <StatRow label="Просмотров" value={stats.content.videos.views.toLocaleString('ru-RU')} />
                <StatRow label="Лайков" value={stats.content.videos.likes.toLocaleString('ru-RU')} />
              </div>
            </AdminCard>

            <AdminCard>
              <h3 className="flex items-center gap-2" style={{ fontSize: 16, fontWeight: 700, margin: '0 0 12px' }}>
                <Film size={20} style={{ color: 'var(--color-muted)' }} aria-hidden />
                Shorts
              </h3>
              <div className="space-y-2">
                <StatRow label="Всего" value={stats.content.shorts.total} />
                <StatRow label="Опубликовано" value={stats.content.shorts.published} tone="brand" />
                <StatRow label="Просмотров" value={stats.content.shorts.views.toLocaleString('ru-RU')} />
                <StatRow label="Лайков" value={stats.content.shorts.likes.toLocaleString('ru-RU')} />
              </div>
            </AdminCard>

            <AdminCard>
              <h3 className="flex items-center gap-2" style={{ fontSize: 16, fontWeight: 700, margin: '0 0 12px' }}>
                <MessageSquare size={20} style={{ color: 'var(--color-muted)' }} aria-hidden />
                Взаимодействие
              </h3>
              <div className="space-y-2">
                <StatRow label="Комментарии" value={stats.content.comments.total} />
                <StatRow label="Сегодня" value={`+${stats.content.comments.today}`} tone="brand" />
                <StatRow label="Избранное" value={stats.content.favorites} />
              </div>
            </AdminCard>

            <AdminCard>
              <h3 className="flex items-center gap-2" style={{ fontSize: 16, fontWeight: 700, margin: '0 0 12px' }}>
                <Star size={20} style={{ color: 'var(--color-muted)' }} aria-hidden />
                Отзывы
              </h3>
              <div className="space-y-2">
                <StatRow label="Всего" value={stats.reviews.total} />
                <StatRow
                  label="На модерации"
                  value={stats.reviews.pending}
                  tone={stats.reviews.pending > 0 ? 'danger' : 'default'}
                />
                <StatRow
                  label="Средний рейтинг"
                  value={
                    <span className="inline-flex items-center gap-1">
                      <Star size={16} aria-hidden />
                      {stats.reviews.avgRating}
                    </span>
                  }
                />
              </div>
            </AdminCard>
          </div>
        </div>
      )}

      {/* ───────── Тренировки ───────── */}
      {activeTab === 'training' && (
        <div className="mb-8">
          <SectionTitle icon={Dumbbell}>Тренировки</SectionTitle>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <AdminCard>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 12px' }}>Статистика сессий</h3>
              <div className="space-y-2">
                <StatRow label="Всего сессий" value={stats.training.total} />
                <StatRow label="Завершено" value={stats.training.completed} tone="brand" />
                <StatRow label="Процент завершения" value={`${stats.training.completionRate}%`} />
              </div>
            </AdminCard>

            <AdminCard>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 12px' }}>Активность</h3>
              <div className="space-y-2">
                <StatRow label="Сегодня" value={stats.training.today} tone="brand" />
                <StatRow label="За неделю" value={stats.training.thisWeek} />
              </div>
            </AdminCard>

            <AdminCard>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 12px' }}>Другое</h3>
              <div className="space-y-2">
                <StatRow label="Тренеров" value={stats.content.trainers} />
              </div>
            </AdminCard>
          </div>
        </div>
      )}

      {/* ───────── Распределения ───────── */}
      {activeTab === 'distributions' && (
        <div className="mb-8">
          <SectionTitle icon={PieChart}>Распределения</SectionTitle>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <AdminCard>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 12px' }}>Позиции игроков</h3>
              {stats.distributions.positions.length === 0 ? (
                <EmptyState icon={Users} title="Пока нет данных" />
              ) : (
                <div className="space-y-2">
                  {stats.distributions.positions.map((pos) => (
                    <StatRow
                      key={pos.position}
                      label={positionNames[pos.position] || pos.position}
                      value={pos.count}
                    />
                  ))}
                </div>
              )}
            </AdminCard>

            <AdminCard>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 12px' }}>Распределение по полу</h3>
              {stats.distributions.genders.length === 0 ? (
                <EmptyState icon={Users} title="Пока нет данных" />
              ) : (
                <div className="space-y-2">
                  {stats.distributions.genders.map((gender) => (
                    <StatRow
                      key={gender.gender}
                      label={gender.gender === 'MALE' ? 'Мужской' : 'Женский'}
                      value={gender.count}
                    />
                  ))}
                </div>
              )}
            </AdminCard>

            <AdminCard>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 12px' }}>Категории видео</h3>
              {stats.distributions.categories.length === 0 ? (
                <EmptyState icon={Video} title="Пока нет данных" />
              ) : (
                <div className="space-y-2">
                  {stats.distributions.categories.map((cat) => (
                    <StatRow
                      key={cat.category}
                      label={categoryNames[cat.category] || cat.category}
                      value={cat.count}
                    />
                  ))}
                </div>
              )}
            </AdminCard>

            <AdminCard>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 12px' }}>Сложность видео</h3>
              {stats.distributions.difficulties.length === 0 ? (
                <EmptyState icon={Video} title="Пока нет данных" />
              ) : (
                <div className="space-y-2">
                  {stats.distributions.difficulties.map((diff) => (
                    <StatRow
                      key={diff.difficulty}
                      label={difficultyNames[diff.difficulty] || diff.difficulty}
                      value={diff.count}
                    />
                  ))}
                </div>
              )}
            </AdminCard>
          </div>
        </div>
      )}

      {/* ───────── Графики ───────── */}
      {activeTab === 'charts' && (
        <div className="mb-8">
          <SectionTitle icon={LineChart}>Графики</SectionTitle>
          <div className="space-y-4">
            <AdminCard>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 16px' }}>
                Регистрации за 30 дней
              </h3>
              <BarChart
                data={stats.charts.registrations.map((day) => ({
                  label: formatDate(day.date),
                  value: day.count,
                }))}
                color="var(--color-brand-blue)"
                unit="регистраций"
                height={224}
                labelEvery={5}
              />
            </AdminCard>

            <AdminCard>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 16px' }}>
                Активность по часам (сегодня)
              </h3>
              <BarChart
                data={Array.from({ length: 24 }, (_, hour) => ({
                  label: `${hour}:00`,
                  value: stats.charts.activity.find((a) => a.hour === hour)?.count || 0,
                }))}
                color="var(--color-brand)"
                unit="активных"
                height={192}
                labelEvery={3}
              />
            </AdminCard>
          </div>
        </div>
      )}

      {/* ───────── ТОП контента ───────── */}
      {activeTab === 'top' && (
        <div className="mb-8">
          <SectionTitle icon={Trophy}>ТОП-5 контента</SectionTitle>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <AdminCard>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 16px' }}>Популярные видео</h3>
              {stats.top.videos.length === 0 ? (
                <EmptyState icon={Video} title="Пока нет данных" />
              ) : (
                <div className="space-y-2">
                  {stats.top.videos.map((video, index) => (
                    <TopRow
                      key={video.id}
                      rank={index + 1}
                      title={video.title}
                      views={video.viewsCount}
                      likes={video.likesCount}
                    />
                  ))}
                </div>
              )}
            </AdminCard>

            <AdminCard>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 16px' }}>Популярные Shorts</h3>
              {stats.top.shorts.length === 0 ? (
                <EmptyState icon={Film} title="Пока нет данных" />
              ) : (
                <div className="space-y-2">
                  {stats.top.shorts.map((short, index) => (
                    <TopRow
                      key={short.id}
                      rank={index + 1}
                      title={short.title}
                      views={short.viewsCount}
                      likes={short.likesCount}
                    />
                  ))}
                </div>
              )}
            </AdminCard>
          </div>
        </div>
      )}

      {/* ───────── Последние регистрации ───────── */}
      {activeTab === 'recent' && (
        <div className="mb-8">
          <SectionTitle icon={UserPlus}>Последние регистрации</SectionTitle>
          <AdminCard>
            {stats.recent.users.length === 0 ? (
              <EmptyState icon={UserPlus} title="Пока никто не зарегистрировался" />
            ) : (
              <div className="space-y-2">
                {stats.recent.users.map((user) => (
                  <Link
                    key={user.id}
                    href="/admin/users"
                    className="flex items-center justify-between gap-3 transition-colors hover:brightness-125"
                    style={{
                      padding: 12,
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--color-night)',
                      border: '1px solid var(--border-hairline)',
                    }}
                  >
                    <span className="min-w-0">
                      <span className="block truncate" style={{ fontSize: 14, fontWeight: 700 }}>
                        {user.firstName || user.username || 'Пользователь'}
                        {user.lastName && ` ${user.lastName}`}
                      </span>
                      <span
                        className="block truncate"
                        style={{ fontSize: 13, color: 'var(--color-muted)' }}
                      >
                        @{user.username || 'без username'}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className="text-right" style={{ fontSize: 12, color: 'var(--color-muted)' }}>
                        <span className="block">
                          {formatDate(user.createdAt)} {formatTime(user.createdAt)}
                        </span>
                        <span className="block">Активность: {formatTime(user.lastActivity)}</span>
                      </span>
                      <ChevronRight size={20} style={{ color: 'var(--color-muted)' }} aria-hidden />
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </AdminCard>
        </div>
      )}
    </AdminPage>
  );
}
