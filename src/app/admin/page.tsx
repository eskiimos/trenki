'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import AccountSwitcher from '@/components/AccountSwitcher';

// Подмножество ответа /api/admin/stats, которое использует дашборд.
interface AdminStats {
  users: { total: number; today: number; thisWeek: number };
  activity: { onlineNow: number; activeToday: number; dauRate: string | number };
  engagement: { pushSubscriptions: number };
  content: {
    videos: { total: number; published: number };
    shorts: { total: number; published: number };
    trainers: number;
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

// ───────── KPI-карточка ─────────
function Kpi({
  icon,
  value,
  label,
  hint,
  href,
  accent,
}: {
  icon: string;
  value: React.ReactNode;
  label: string;
  hint?: string;
  href?: string;
  accent?: boolean;
}) {
  const body = (
    <div
      className={`h-full rounded-xl p-4 border transition-colors ${
        accent
          ? 'bg-[#A1FF4A]/10 border-[#A1FF4A]/30 hover:bg-[#A1FF4A]/15'
          : 'bg-[#1a1f3a] border-white/5 hover:bg-[#2d3448]'
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg leading-none">{icon}</span>
        <span className="text-[11px] uppercase tracking-wider text-gray-400">{label}</span>
      </div>
      <div className={`text-2xl font-bold leading-none ${accent ? 'text-[#A1FF4A]' : 'text-white'}`}>
        {value}
      </div>
      {hint && <div className="text-xs text-gray-500 mt-1">{hint}</div>}
    </div>
  );
  return href ? (
    <Link href={href} className="block h-full">
      {body}
    </Link>
  ) : (
    body
  );
}

// ───────── Мини-спарклайн (CSS-бары, без либы) ─────────
function Sparkline({ data, color }: { data: Array<{ date: string; count: number }>; color: string }) {
  if (!data.length) {
    return <div className="h-16 flex items-center justify-center text-xs text-gray-600">нет данных</div>;
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

// ───────── Навигационная карточка раздела ─────────
function NavCard({
  href,
  icon,
  title,
  desc,
  badge,
}: {
  href: string;
  icon: string;
  title: string;
  desc: string;
  badge?: number;
}) {
  return (
    <Link href={href}>
      <div className="group relative h-full bg-[#1a1f3a] rounded-xl p-4 border border-white/5 hover:bg-[#2d3448] hover:border-white/10 transition-colors cursor-pointer">
        {badge ? (
          <span className="absolute top-3 right-3 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-[#FF6B6B] text-white text-xs font-bold">
            {badge}
          </span>
        ) : null}
        <div className="flex items-start gap-3">
          <span className="text-2xl leading-none mt-0.5">{icon}</span>
          <div>
            <h3 className="text-base font-semibold text-white">{title}</h3>
            <p className="text-sm text-gray-400 mt-0.5">{desc}</p>
          </div>
        </div>
      </div>
    </Link>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">{children}</h2>
  );
}

export default function AdminPage() {
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
    <div
      className="min-h-screen bg-[#101530] text-white px-4 pb-10 md:px-8"
      style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)' }}
    >
      <div className="max-w-7xl mx-auto">
        {/* Шапка */}
        <div className="flex items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-white hover:text-gray-300 transition-colors">
              <Image src="/icons/icon-action-back.svg" alt="Назад" width={24} height={24} />
            </Link>
            <h1 className="text-2xl md:text-3xl font-bold">Админ-панель</h1>
          </div>
          <div className="w-full max-w-[220px]">
            <AccountSwitcher />
          </div>
        </div>

        {/* ───────── KPI ───────── */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-[92px] rounded-xl bg-[#1a1f3a] border border-white/5 animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <div className="mb-8 rounded-xl bg-[#1a1f3a] border border-white/5 p-4 text-sm text-gray-400">
            Не удалось загрузить метрики. Разделы ниже доступны.
          </div>
        ) : stats ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
            <Kpi
              icon="👥"
              label="Пользователи"
              value={num(stats.users.total)}
              hint={`+${num(stats.users.today)} сегодня`}
              href="/admin/users"
            />
            <Kpi icon="🟢" label="Онлайн" value={num(stats.activity.onlineNow)} hint="сейчас" />
            <Kpi
              icon="📹"
              label="Видео"
              value={num(stats.content.videos.total)}
              hint={`${num(stats.content.videos.published)} опубл.`}
              href="/admin/videos"
            />
            <Kpi icon="🏋" label="Тренировки" value={num(stats.training.today)} hint="сегодня" />
            <Kpi
              icon="🔔"
              label="Push"
              value={num(stats.engagement.pushSubscriptions)}
              hint="подписки"
            />
            <Kpi
              icon="⭐"
              label="Отзывы"
              value={num(stats.reviews.pending)}
              hint="на модерации"
              href="/admin/reviews"
              accent={stats.reviews.pending > 0}
            />
          </div>
        ) : null}

        {/* ───────── Мини-графики ───────── */}
        {stats && !error && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            <div className="rounded-xl bg-[#1a1f3a] border border-white/5 p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-xs uppercase tracking-wider text-gray-400">Регистрации</div>
                  <div className="text-lg font-bold">{num(regSum)} за 30 дней</div>
                </div>
                <Link href="/admin/stats" className="text-xs text-[#A1FF4A] hover:underline">
                  Подробнее →
                </Link>
              </div>
              <Sparkline data={stats.charts.registrations} color="#445CFF" />
            </div>
            <div className="rounded-xl bg-[#1a1f3a] border border-white/5 p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-xs uppercase tracking-wider text-gray-400">Тренировки</div>
                  <div className="text-lg font-bold">{num(sessSum)} за 30 дней</div>
                </div>
                <Link href="/admin/stats" className="text-xs text-[#A1FF4A] hover:underline">
                  Подробнее →
                </Link>
              </div>
              <Sparkline data={stats.charts.sessions} color="#A1FF4A" />
            </div>
          </div>
        )}

        {/* ───────── Последние регистрации ───────── */}
        {stats && stats.recent.users.length > 0 && (
          <div className="rounded-xl bg-[#1a1f3a] border border-white/5 p-4 mb-8">
            <div className="flex items-center justify-between mb-3">
              <SectionTitle>Последние регистрации</SectionTitle>
              <Link href="/admin/users" className="text-xs text-[#A1FF4A] hover:underline -mt-3">
                Все →
              </Link>
            </div>
            <div className="divide-y divide-white/5">
              {stats.recent.users.slice(0, 6).map((u) => {
                const name =
                  [u.firstName, u.lastName].filter(Boolean).join(' ') ||
                  u.username ||
                  'Без имени';
                return (
                  <div key={u.id} className="flex items-center justify-between py-2">
                    <span className="text-sm text-white truncate">{name}</span>
                    <span className="text-xs text-gray-500 shrink-0 ml-3">{timeAgo(u.createdAt)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ───────── Разделы ───────── */}
        <div className="space-y-8">
          <div>
            <SectionTitle>📹 Контент</SectionTitle>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <NavCard href="/admin/videos" icon="📹" title="Видео" desc="Каталог и публикация" />
              <NavCard href="/admin/shorts" icon="⚡" title="Треньки" desc="Короткие ролики (shorts)" />
              <NavCard href="/admin/trainers" icon="🎓" title="Тренеры" desc="Профили тренеров" />
              <NavCard
                href="/admin/training-modules"
                icon="🧩"
                title="Тренировочные модули"
                desc="Модули и упражнения"
              />
              <NavCard
                href="/admin/gamification"
                icon="🎮"
                title="Геймификация"
                desc="Песочница: уровни, звания, стрик"
              />
            </div>
          </div>

          <div>
            <SectionTitle>👥 Пользователи</SectionTitle>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <NavCard href="/admin/users" icon="👤" title="Пользователи" desc="Список и управление" />
              <NavCard href="/admin/referrals" icon="🔗" title="Реферальные каналы" desc="Коды/ссылки сборов и кто пришёл" />
              <NavCard href="/admin/invite-codes" icon="🎟️" title="Инвайт-коды" desc="Коды приглашений" />
              <NavCard href="/admin/admins" icon="🔐" title="Администраторы" desc="Права доступа" />
              <NavCard
                href="/admin/reviews"
                icon="⭐"
                title="Отзывы"
                desc="Модерация отзывов о тренерах"
                badge={stats?.reviews.pending || undefined}
              />
            </div>
          </div>

          <div>
            <SectionTitle>📊 Аналитика и коммуникация</SectionTitle>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <NavCard href="/admin/stats" icon="📊" title="Статистика" desc="Полная аналитика" />
              <NavCard href="/admin/notifications" icon="🔔" title="Уведомления" desc="Push-рассылки" />
              <NavCard href="/admin/reminders" icon="⏰" title="Время уведомлений" desc="Когда слать пуши (ежедн. + предтрен.)" />
            </div>
          </div>

          <div>
            <SectionTitle>⚙️ Система</SectionTitle>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <NavCard
                href="/admin/paywall"
                icon="🔒"
                title="Paywall (подписка)"
                desc="Вкл/выкл, режим обкатки на админах"
              />
              <NavCard
                href="/admin/content-check"
                icon="🔎"
                title="Проверка контента"
                desc="Целостность данных"
              />
              <NavCard
                href="/admin/ui-kit"
                icon="🎨"
                title="UI-кит"
                desc="Токены и компоненты"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
