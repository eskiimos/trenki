'use client';

import { useSubscription } from '@/hooks/useSubscription';
import { openSubscriptionModal } from '@/lib/subscription-modal';
import { plural } from '@/lib/plural';

// Инлайновая карточка «подписка скоро закончится → продлить» (п.5, дизайн из Figma).
// Показывается только премиум-юзеру с конечным premiumUntil за 3 дня до конца.
// Бессрочный премиум (premiumUntil=null) и FREE — не показываем.
// Цвет — тёплый оранжевый (токен --color-danger): правка владельца «Начало
// сентября» — сине-зелёная карточка читалась как обычный промо-блок, а не как
// предупреждение.

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

  const label =
    days <= 0 ? 'СЕГОДНЯ' : `ЧЕРЕЗ ${days} ${plural(days, ['день', 'дня', 'дней']).toUpperCase()}`;

  return (
    <div
      role="status"
      style={{
        background: 'var(--color-danger)',
        borderRadius: 18,
        padding: 18,
        marginBottom: 24,
      }}
    >
      <div
        className="font-overpass uppercase"
        style={{
          color: 'var(--color-night)',
          fontWeight: 900,
          fontSize: 15,
          lineHeight: 1.25,
          textAlign: 'center',
          letterSpacing: 0.3,
        }}
      >
        Подписка скоро закончится =(<br />
        {label}
      </div>
      <button
        type="button"
        onClick={() => openSubscriptionModal('expiring')}
        className="font-overpass uppercase transition-transform active:scale-95"
        style={{
          width: '100%',
          marginTop: 14,
          background: 'var(--color-night)',
          color: 'var(--color-ink)',
          border: 'none',
          borderRadius: 999,
          padding: '15px 20px',
          fontWeight: 900,
          fontSize: 15,
          letterSpacing: 0.3,
          cursor: 'pointer',
        }}
      >
        Продлить подписку
      </button>
    </div>
  );
}
