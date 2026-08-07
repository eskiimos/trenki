'use client';

// Родительский кабинет: список детей (ParentLink) с прогрессом read-only —
// звание/уровень/XP, стрик, активность за неделю, потенциал. Детского тапбара
// здесь нет намеренно: родителю нужен только обзор.

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { clearAuth } from '@/lib/auth';
import { useSubscriptionPricing } from '@/hooks/useSubscriptionPricing';

interface ChildCard {
  id: string;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  potential: number | null;
  premium: { active: boolean; until: string | null };
  gamification: {
    level: number;
    xpIntoLevel: number;
    xpForNext: number;
    status: { key: string; title: string; emoji: string };
    nextStatus: { title: string; minLevel: number } | null;
    streak: number;
  };
  week: { workouts: number; modules: number };
}

/** «1 тренировка / 2 тренировки / 5 тренировок» */
function plural(n: number, forms: [string, string, string]): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1];
  return forms[2];
}

function childName(c: ChildCard): string {
  return [c.firstName, c.lastName].filter(Boolean).join(' ') || 'Хоккеист';
}

/** «7 сентября 2026» для premiumUntil */
function formatUntil(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}

const ChildCardView = ({ child }: { child: ChildCard }) => {
  const g = child.gamification;
  const xpPercent = Math.min(100, Math.round((g.xpIntoLevel / Math.max(1, g.xpForNext)) * 100));
  const pricing = useSubscriptionPricing();
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  // Оплата подписки ребёнка родителем: T-Bank Init с childId → редирект на оплату
  const handleSubscribe = async () => {
    if (paying) return;
    setPaying(true);
    setPayError(null);
    try {
      const res = await fetch('/api/payments/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ childId: child.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.paymentURL) {
        window.location.href = data.paymentURL;
        return;
      }
      setPayError(data?.error || 'Не удалось перейти к оплате');
    } catch {
      setPayError('Сетевая ошибка. Проверь подключение.');
    } finally {
      setPaying(false);
    }
  };
  return (
    <div className="bg-surface rounded-2xl p-4 border border-white/5">
      {/* Шапка: аватар + имя + стрик */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative w-12 h-12 rounded-full overflow-hidden bg-white/10 shrink-0 flex items-center justify-center">
          {child.avatarUrl ? (
            <Image src={child.avatarUrl} alt="" fill className="object-cover" sizes="48px" />
          ) : (
            <span className="text-white text-lg font-bold">
              {(child.firstName || 'Х').charAt(0).toUpperCase()}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-white text-base font-bold truncate">{childName(child)}</div>
          {g.streak > 0 && (
            <div className="text-muted text-xs mt-0.5">
              🔥 Серия: {g.streak} {plural(g.streak, ['день', 'дня', 'дней'])}
            </div>
          )}
        </div>
      </div>

      {/* Звание + уровень + XP */}
      <div className="flex items-center justify-between mb-2">
        <span className="inline-flex items-center gap-1.5 bg-brand text-night text-xs font-bold font-overpass uppercase rounded-full px-3 py-1">
          <span aria-hidden>{g.status.emoji}</span>
          {g.status.title}
        </span>
        <span className="text-white text-sm font-bold font-overpass">Уровень {g.level}</span>
      </div>
      <div className="h-2 rounded-full bg-white/10 overflow-hidden">
        <div
          className="h-full rounded-full bg-brand transition-all"
          style={{ width: `${xpPercent}%` }}
        />
      </div>
      <div className="text-muted text-xs mt-1.5 mb-4">
        XP: {g.xpIntoLevel}/{g.xpForNext} · до следующего уровня
      </div>

      {/* За неделю + потенциал */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-white/5 p-3">
          <div className="text-muted text-[11px] font-overpass uppercase tracking-wide mb-1">
            За неделю
          </div>
          <div className="text-white text-sm font-bold">
            {child.week.workouts} {plural(child.week.workouts, ['тренировка', 'тренировки', 'тренировок'])}
          </div>
          <div className="text-muted text-xs">
            {child.week.modules} {plural(child.week.modules, ['модуль', 'модуля', 'модулей'])}
          </div>
        </div>
        <div className="rounded-xl bg-white/5 p-3">
          <div className="text-muted text-[11px] font-overpass uppercase tracking-wide mb-1">
            Потенциал
          </div>
          <div className="text-brand text-xl font-bold">
            {child.potential != null ? Math.round(child.potential) : '—'}
          </div>
        </div>
      </div>

      {/* Подписка ребёнка */}
      <div className="rounded-xl bg-white/5 p-3 mt-2">
        <div className="text-muted text-[11px] font-overpass uppercase tracking-wide mb-1">
          Подписка
        </div>
        {child.premium.active ? (
          <div className="text-brand text-sm font-bold">
            {child.premium.until
              ? `Подписка до ${formatUntil(child.premium.until)}`
              : 'Подписка активна'}
          </div>
        ) : (
          <>
            <div className="text-white text-sm font-bold mb-2">Подписки нет</div>
            <button
              type="button"
              onClick={handleSubscribe}
              disabled={paying}
              className="w-full bg-brand text-night rounded-full py-2.5 px-4 text-sm font-bold font-overpass uppercase transition-transform active:scale-95 disabled:opacity-70"
            >
              {paying ? 'Переходим к оплате…' : `Оформить подписку — ${pricing.priceMonthlyRub} ₽/мес`}
            </button>
            {payError && (
              <p className="text-red-400 text-xs text-center mt-2">{payError}</p>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default function ParentPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [children, setChildren] = useState<ChildCard[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = await fetch('/api/users/me', { cache: 'no-store', credentials: 'include' });
        if (cancelled) return;
        if (me.status === 401) {
          router.replace('/login');
          return;
        }
        const res = await fetch('/api/parent/children', {
          cache: 'no-store',
          credentials: 'include',
        });
        if (cancelled) return;
        if (!res.ok) {
          setError('Не удалось загрузить данные. Потяни страницу вниз или зайди позже.');
          setIsLoading(false);
          return;
        }
        const data = await res.json();
        setChildren(Array.isArray(data.children) ? data.children : []);
        setIsLoading(false);
      } catch {
        if (!cancelled) {
          setError('Сетевая ошибка. Проверь подключение.');
          setIsLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const handleLogout = async () => {
    await clearAuth(); // POST /api/auth/logout + чистка локального кеша
    router.replace('/login');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-night flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand" />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-night text-white"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 24px)' }}
    >
      <div className="max-w-md mx-auto px-4 pt-6">
        {/* Заголовок + выход */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-white text-2xl font-bold">Мои хоккеисты</h1>
          <button
            type="button"
            onClick={handleLogout}
            className="text-muted text-sm font-medium font-overpass uppercase tracking-wide hover:text-white transition-colors"
          >
            Выйти
          </button>
        </div>

        {error && (
          <div className="p-4 bg-red-500/20 border border-red-500 rounded-xl mb-4">
            <p className="text-red-400 text-sm text-center">{error}</p>
          </div>
        )}

        {!error && children.length === 0 && (
          <div className="bg-surface rounded-2xl p-8 text-center border border-white/5">
            <div className="text-4xl mb-4" aria-hidden>🏒</div>
            <h2 className="text-white text-lg font-bold mb-2">Пока нет привязанных детей</h2>
            <p className="text-muted text-sm leading-relaxed">
              Попроси ребёнка открыть Профиль → Родителям и прислать тебе ссылку-приглашение.
            </p>
          </div>
        )}

        <div className="flex flex-col gap-4">
          {children.map((child) => (
            <ChildCardView key={child.id} child={child} />
          ))}
        </div>
      </div>
    </div>
  );
}
