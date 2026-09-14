'use client';

import { AlertTriangle } from 'lucide-react';
import { useSubscription } from '@/hooks/useSubscription';
import { openSubscriptionModal } from '@/lib/subscription-modal';
import { plural } from '@/lib/plural';

// Инлайновая карточка «подписка заканчивается → продлить».
// Показывается только премиум-юзеру с конечным premiumUntil за 3 дня до конца.
// Бессрочный премиум (premiumUntil=null) и FREE — не показываем.
//
// Оформление (правка владельца 14.09): вместо сплошной оранжевой заливки —
// градиент, как у бейджа «Ударный темп»: по краям цвет плотнее, в центре
// просвечивает тёмный фон приложения. Только краснее: рамка, свечение
// вовнутрь и сам текст — красные (--color-alert). Текст ужат до «Подписка
// закончится через N дней» (без «скоро»), отступы уменьшены — карточка
// занимает меньше первого экрана.

const EXPIRY_WINDOW_DAYS = 3;

export default function SubscriptionExpiryCard() {
  const { hasPremium, premiumUntil, paywallActive } = useSubscription();

  // В режиме 'off' paywall не активен → баннер продления не показываем (иначе
  // премиум-юзеры увидели бы новый баннер там, где до paywall его не было).
  if (!paywallActive || !hasPremium || !premiumUntil) return null;
  const until = new Date(premiumUntil).getTime();
  if (isNaN(until)) return null;

  const days = Math.ceil((until - Date.now()) / 86_400_000);
  if (days < 0 || days > EXPIRY_WINDOW_DAYS) return null;

  const when =
    days <= 0 ? 'сегодня' : `через ${days} ${plural(days, ['день', 'дня', 'дней'])}`;

  return (
    <div
      role="status"
      style={{
        background: 'var(--grad-alert)',
        border: '1px solid var(--border-alert)',
        boxShadow: 'var(--glow-alert-inset)',
        borderRadius: 'var(--radius-lg)',
        padding: 14,
        marginBottom: 16,
      }}
    >
      <div
        className="font-overpass uppercase flex items-center justify-center gap-2"
        style={{
          color: 'var(--alert-text)',
          fontWeight: 900,
          fontSize: 14,
          lineHeight: 1.2,
          textAlign: 'center',
          letterSpacing: 0.3,
        }}
      >
        <AlertTriangle size={16} className="shrink-0" aria-hidden />
        <span>Подписка закончится {when}</span>
      </div>
      <button
        type="button"
        onClick={() => openSubscriptionModal('expiring')}
        className="font-overpass uppercase transition-transform active:scale-95"
        style={{
          width: '100%',
          marginTop: 10,
          height: 44,
          background: 'var(--color-alert)',
          color: 'var(--color-ink)',
          border: 'none',
          borderRadius: 'var(--radius-pill)',
          fontWeight: 900,
          fontSize: 14,
          letterSpacing: 0.3,
          cursor: 'pointer',
        }}
      >
        Продлить подписку
      </button>
    </div>
  );
}
