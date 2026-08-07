'use client';

// Родительский кабинет: список детей (ParentLink) с прогрессом read-only —
// звание/уровень/XP, стрик, активность за неделю, потенциал. Детского тапбара
// здесь нет намеренно: родителю нужен только обзор.

import Image from 'next/image';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { clearAuth } from '@/lib/auth';
import { useSubscriptionPricing } from '@/hooks/useSubscriptionPricing';
import LeagueTable from '@/components/LeagueTable';
import PotentialRing from '@/components/PotentialRing';

interface ChildCard {
  id: string;
  // Связь ParentLink: для подтверждения/отклонения запроса на отвязку и self-unlink
  linkId: string;
  unlinkRequestedAt: string | null;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  potential: number | null;
  ratings: {
    power: number | null;
    speed: number | null;
    endurance: number | null;
    technique: number | null;
    flexibility: number | null;
  };
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

const ChildCardView = ({
  child,
  onLinkChanged,
}: {
  child: ChildCard;
  /** Рефетч списка после confirm/decline/unlink — карточка исчезает или баннер снимается */
  onLinkChanged: () => void;
}) => {
  const g = child.gamification;
  const xpPercent = Math.min(100, Math.round((g.xpIntoLevel / Math.max(1, g.xpForNext)) * 100));
  const pricing = useSubscriptionPricing();
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  // Кольцо потенциала (как в профиле ребёнка) — раскрывается по тапу на карточку
  const [potentialOpen, setPotentialOpen] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const [unlinkError, setUnlinkError] = useState<string | null>(null);

  // confirm — подтвердить запрос ребёнка; decline — отклонить; unlink — отвязать самому
  const handleUnlinkAction = async (action: 'confirm' | 'decline' | 'unlink') => {
    if (unlinking) return;
    if (action === 'confirm' && !confirm(`Подтвердить отвязку? ${childName(child)} исчезнет из вашего кабинета.`)) {
      return;
    }
    if (action === 'unlink' && !confirm(`Отвязать ${childName(child)}? Вы перестанете видеть его прогресс.`)) {
      return;
    }
    setUnlinking(true);
    setUnlinkError(null);
    try {
      const res = await fetch('/api/parent/unlink', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ linkId: child.linkId, action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setUnlinkError(data?.error || 'Не удалось выполнить действие');
        return;
      }
      onLinkChanged();
    } catch {
      setUnlinkError('Сетевая ошибка. Проверь подключение.');
    } finally {
      setUnlinking(false);
    }
  };

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
      {/* Запрос ребёнка на отвязку — заметный баннер, связь рвётся только после подтверждения */}
      {child.unlinkRequestedAt && (
        <div className="rounded-xl bg-amber-400/10 border border-amber-400/30 p-3 mb-4">
          <div className="text-amber-300 text-sm font-bold mb-2">
            {childName(child)} просит отвязать вас
          </div>
          <p className="text-white/70 text-xs leading-relaxed mb-3">
            После подтверждения вы перестанете видеть прогресс ребёнка, карточка исчезнет из
            кабинета.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleUnlinkAction('confirm')}
              disabled={unlinking}
              className="bg-amber-400 text-night text-xs font-bold font-overpass uppercase tracking-wide rounded-full py-2.5 transition-transform active:scale-95 disabled:opacity-60"
            >
              Подтвердить отвязку
            </button>
            <button
              type="button"
              onClick={() => handleUnlinkAction('decline')}
              disabled={unlinking}
              className="bg-white/10 text-white text-xs font-bold font-overpass uppercase tracking-wide rounded-full py-2.5 hover:bg-white/15 transition-colors disabled:opacity-60"
            >
              Отклонить
            </button>
          </div>
        </div>
      )}

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
        <button
          type="button"
          onClick={() => setPotentialOpen((v) => !v)}
          aria-expanded={potentialOpen}
          className="rounded-xl bg-white/5 p-3 text-left transition-colors hover:bg-white/10 active:bg-white/10"
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-muted text-[11px] font-overpass uppercase tracking-wide">
              Потенциал
            </span>
            <span className="text-muted text-xs" aria-hidden>
              {potentialOpen ? '▲' : '▼'}
            </span>
          </div>
          <div className="text-brand text-xl font-bold">
            {child.potential != null ? Math.round(child.potential) : '—'}
          </div>
        </button>
      </div>

      {/* Полное кольцо потенциала — тот же визуал, что в профиле ребёнка.
          Родитель видит всё без подписочного гейта (grayed=false). */}
      {potentialOpen && (
        <div className="mt-2">
          <PotentialRing ratings={child.ratings} potential={child.potential} grayed={false} />
        </div>
      )}

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

      {/* Лига сверстников (по году рождения) — раскрывается по тапу */}
      <LeagueTable childId={child.id} />

      {/* Self-unlink: родитель может отвязаться сам в любой момент */}
      {unlinkError && <p className="text-red-400 text-xs text-center mt-3">{unlinkError}</p>}
      <div className="text-center mt-3">
        <button
          type="button"
          onClick={() => handleUnlinkAction('unlink')}
          disabled={unlinking}
          className="text-muted text-[11px] font-medium font-overpass uppercase tracking-wide hover:text-red-400 transition-colors disabled:opacity-60"
        >
          {unlinking ? 'Отвязываем…' : 'Отвязать'}
        </button>
      </div>
    </div>
  );
};

export default function ParentPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [children, setChildren] = useState<ChildCard[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Рефетч списка детей — используется и при загрузке, и после
  // подтверждения/отклонения запроса на отвязку (карточка исчезает/баннер снимается).
  const loadChildren = useCallback(async () => {
    try {
      const res = await fetch('/api/parent/children', {
        cache: 'no-store',
        credentials: 'include',
      });
      if (!res.ok) {
        setError('Не удалось загрузить данные. Потяни страницу вниз или зайди позже.');
        return;
      }
      const data = await res.json();
      setChildren(Array.isArray(data.children) ? data.children : []);
      setError(null);
    } catch {
      setError('Сетевая ошибка. Проверь подключение.');
    }
  }, []);

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
        await loadChildren();
      } catch {
        if (!cancelled) setError('Сетевая ошибка. Проверь подключение.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router, loadChildren]);

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
            <ChildCardView key={child.linkId} child={child} onLinkChanged={loadChildren} />
          ))}
        </div>
      </div>
    </div>
  );
}
