'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import AccountSwitcher from '@/components/AccountSwitcher';
import {
  AdminPage,
  PageHeader,
  SectionTitle,
  AdminCard,
  Kpi,
  NavCard,
  EmptyState,
} from '@/components/admin/ui';
import {
  Users, Activity, Video, Dumbbell, Bell, Star, MessageSquare,
  Film, BarChart3, Settings, Zap, GraduationCap, Blocks, Gamepad2,
  Link2, Ticket, ShieldCheck, Send, AlarmClock, Lock, ScanSearch, Palette,
  ArrowRight, LayoutDashboard, AlertTriangle,
} from 'lucide-react';

// Подмножество ответа /api/admin/stats, которое использует дашборд.
interface AdminStats {
  users: { total: number; today: number; thisWeek: number };
  activity: { onlineNow: number; activeToday: number; dauRate: string | number };
  engagement: { pushSubscriptions: number };
  content: {
    videos: { total: number; published: number };
    shorts: { total: number; published: number };
    trainers: number;
    comments: { total: number; today: number };
  };
  training: { total: number; today: number; completionRate: string | number };
  reviews: { total: number; pending: number; avgRating: string | number };
  charts: {
    registrations: Array<{ date: string; count: number }>;
    sessions: Array<{ date: string; count: number }>;
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
}

/** Сколько KPI-карточек рендерится — скелетон берёт это же число, чтобы при
 *  загрузке не было прыжка вёрстки (раньше скелетон рисовал 6, карточек было 7). */
const KPI_COUNT = 7;

const num = (v: number | string | undefined): string => {
  const n = typeof v === 'string' ? parseFloat(v) : v ?? 0;
  return (n || 0).toLocaleString('ru-RU');
};

const timeAgo = (iso: string): string => {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'только что';
  if (m < 60) return `${m} мин назад`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ч назад`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'вчера';
  return `${d} дн назад`;
};

// ───────── Мини-спарклайн (CSS-бары, без либы) ─────────
function Sparkline({ data, color }: { data: Array<{ date: string; count: number }>; color: string }) {
  if (!data.length) {
    return (
      <div className="h-16 flex items-center justify-center" style={{ fontSize: 12, color: 'var(--color-muted)' }}>
        нет данных
      </div>
    );
  }
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <div className="flex items-end gap-[2px] h-16">
      {data.map((d, i) => (
        <div
          key={i}
          className="flex-1 rounded-t-sm min-h-[2px]"
          style={{ height: `${Math.max(3, (d.count / max) * 100)}%`, backgroundColor: color }}
          title={`${d.date}: ${d.count}`}
        />
      ))}
    </div>
  );
}

/** Ссылка «Подробнее →» в шапке блока (иконка вместо текстовой стрелки). */
function MoreLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 hover:underline shrink-0"
      style={{ fontSize: 12, color: 'var(--color-brand)' }}
    >
      {children}
      <ArrowRight size={16} aria-hidden />
    </Link>
  );
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/admin/stats')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('stats'))))
      .then((d) => {
        if (!cancelled) setStats(d);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const regSum = stats?.charts.registrations.reduce((s, d) => s + d.count, 0) ?? 0;
  const sessSum = stats?.charts.sessions.reduce((s, d) => s + d.count, 0) ?? 0;

  return (
    <AdminPage>
      <PageHeader
        title="Админ-панель"
        icon={LayoutDashboard}
        backHref="/"
        backLabel="В приложение"
        actions={
          <div className="w-full max-w-[220px]">
            <AccountSwitcher />
          </div>
        }
      />

      {/* ───────── KPI ───────── */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3 mb-8">
          {Array.from({ length: KPI_COUNT }).map((_, i) => (
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
      ) : error ? (
        <div className="mb-8">
          <AdminCard tone="danger">
            <div className="flex items-center gap-3">
              <AlertTriangle size={20} style={{ color: 'var(--color-danger)' }} aria-hidden />
              <span style={{ fontSize: 14 }}>Не удалось загрузить метрики. Разделы ниже доступны.</span>
            </div>
          </AdminCard>
        </div>
      ) : stats ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3 mb-8">
          <Kpi
            icon={Users}
            label="Пользователи"
            value={num(stats.users.total)}
            hint={`+${num(stats.users.today)} сегодня`}
            href="/admin/users"
          />
          <Kpi icon={Activity} label="Онлайн" value={num(stats.activity.onlineNow)} hint="сейчас" />
          <Kpi
            icon={Video}
            label="Видео"
            value={num(stats.content.videos.total)}
            hint={`${num(stats.content.videos.published)} опубл.`}
            href="/admin/videos"
          />
          <Kpi icon={Dumbbell} label="Тренировки" value={num(stats.training.today)} hint="сегодня" />
          <Kpi icon={Bell} label="Push" value={num(stats.engagement.pushSubscriptions)} hint="подписки" />
          <Kpi
            icon={Star}
            label="Отзывы"
            value={num(stats.reviews.pending)}
            hint="на модерации"
            href="/admin/reviews"
            accent={stats.reviews.pending > 0}
          />
          <Kpi
            icon={MessageSquare}
            label="Комментарии"
            value={num(stats.content.comments.today)}
            hint="за сегодня"
            href="/admin/comments"
            accent={stats.content.comments.today > 0}
          />
        </div>
      ) : null}

      {/* ───────── Мини-графики ───────── */}
      {stats && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <AdminCard>
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <div
                  style={{
                    fontSize: 12,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    color: 'var(--color-muted)',
                  }}
                >
                  Регистрации
                </div>
                <div style={{ fontSize: 18, fontWeight: 800 }}>{num(regSum)} за 30 дней</div>
              </div>
              <MoreLink href="/admin/stats">Подробнее</MoreLink>
            </div>
            <Sparkline data={stats.charts.registrations} color="var(--color-brand-blue)" />
          </AdminCard>
          <AdminCard>
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <div
                  style={{
                    fontSize: 12,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    color: 'var(--color-muted)',
                  }}
                >
                  Тренировки
                </div>
                <div style={{ fontSize: 18, fontWeight: 800 }}>{num(sessSum)} за 30 дней</div>
              </div>
              <MoreLink href="/admin/stats">Подробнее</MoreLink>
            </div>
            <Sparkline data={stats.charts.sessions} color="var(--color-brand)" />
          </AdminCard>
        </div>
      )}

      {/* ───────── Последние регистрации ───────── */}
      {stats && (
        <div className="mb-8">
          <AdminCard>
            <div className="flex items-start justify-between gap-3">
              <SectionTitle icon={Users}>Последние регистрации</SectionTitle>
              <MoreLink href="/admin/users">Все</MoreLink>
            </div>
            {stats.recent.users.length === 0 ? (
              <EmptyState title="Пока никто не зарегистрировался" />
            ) : (
              <div className="divide-y" style={{ borderColor: 'var(--border-hairline)' }}>
                {stats.recent.users.slice(0, 6).map((u) => {
                  const name =
                    [u.firstName, u.lastName].filter(Boolean).join(' ') || u.username || 'Без имени';
                  return (
                    <div key={u.id} className="flex items-center justify-between py-2">
                      <span style={{ fontSize: 14 }} className="truncate">
                        {name}
                      </span>
                      <span
                        className="shrink-0 ml-3"
                        style={{ fontSize: 12, color: 'var(--color-muted)' }}
                      >
                        {timeAgo(u.createdAt)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </AdminCard>
        </div>
      )}

      {/* ───────── Разделы ───────── */}
      <div className="space-y-8">
        <div>
          <SectionTitle icon={Film}>Контент</SectionTitle>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <NavCard href="/admin/videos" icon={Video} title="Видео" desc="Каталог и публикация" />
            <NavCard href="/admin/shorts" icon={Zap} title="Треньки" desc="Короткие ролики (shorts)" />
            <NavCard href="/admin/trainers" icon={GraduationCap} title="Тренеры" desc="Профили тренеров" />
            <NavCard
              href="/admin/training-modules"
              icon={Blocks}
              title="Тренировочные модули"
              desc="Модули и упражнения"
            />
            <NavCard
              href="/admin/gamification"
              icon={Gamepad2}
              title="Геймификация"
              desc="Песочница: уровни, звания, стрик"
            />
          </div>
        </div>

        <div>
          <SectionTitle icon={Users}>Пользователи</SectionTitle>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <NavCard href="/admin/users" icon={Users} title="Пользователи" desc="Список и управление" />
            <NavCard
              href="/admin/referrals"
              icon={Link2}
              title="Реферальные каналы"
              desc="Коды/ссылки сборов и кто пришёл"
            />
            <NavCard href="/admin/invite-codes" icon={Ticket} title="Инвайт-коды" desc="Коды приглашений" />
            <NavCard href="/admin/admins" icon={ShieldCheck} title="Администраторы" desc="Права доступа" />
            <NavCard
              href="/admin/reviews"
              icon={Star}
              title="Отзывы"
              desc="Модерация отзывов о тренерах"
              badge={stats?.reviews.pending || undefined}
            />
            <NavCard
              href="/admin/comments"
              icon={MessageSquare}
              title="Комментарии"
              desc="Модерация комментов к видео и тренькам"
              badge={stats?.content.comments.today || undefined}
            />
          </div>
        </div>

        <div>
          <SectionTitle icon={BarChart3}>Аналитика и коммуникация</SectionTitle>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <NavCard href="/admin/stats" icon={BarChart3} title="Статистика" desc="Полная аналитика" />
            <NavCard href="/admin/notifications" icon={Send} title="Уведомления" desc="Push-рассылки" />
            <NavCard
              href="/admin/reminders"
              icon={AlarmClock}
              title="Время уведомлений"
              desc="Когда слать пуши (ежедн. + предтрен.)"
            />
          </div>
        </div>

        <div>
          <SectionTitle icon={Settings}>Система</SectionTitle>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <NavCard
              href="/admin/paywall"
              icon={Lock}
              title="Paywall (подписка)"
              desc="Вкл/выкл, режим обкатки на админах"
            />
            <NavCard
              href="/admin/content-check"
              icon={ScanSearch}
              title="Проверка контента"
              desc="Целостность данных"
            />
            <NavCard href="/admin/ui-kit" icon={Palette} title="UI-кит" desc="Токены и компоненты" />
          </div>
        </div>
      </div>
    </AdminPage>
  );
}
