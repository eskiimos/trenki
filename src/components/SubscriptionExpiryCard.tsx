'use client';

import { useSubscription } from '@/hooks/useSubscription';
import { openSubscriptionModal } from '@/lib/subscription-modal';

// Инлайновая карточка «подписка скоро закончится → продлить» (п.5, дизайн из Figma).
// Показывается только премиум-юзеру с конечным premiumUntil за 3 дня до конца.
// Бессрочный премиум (premiumUntil=null) и FREE — не показываем.

const EXPIRY_WINDOW_DAYS = 3;

function pluralDays(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'день';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'дня';
  return 'дней';
}

export default function SubscriptionExpiryCard() {
  const { hasPremium, premiumUntil } = useSubscription();

  if (!hasPremium || !premiumUntil) return null;
  const until = new Date(premiumUntil).getTime();
  if (isNaN(until)) return null;

  const days = Math.ceil((until - Date.now()) / 86_400_000);
  if (days < 0 || days > EXPIRY_WINDOW_DAYS) return null;

  const label = days <= 0 ? 'СЕГОДНЯ' : `ЧЕРЕЗ ${days} ${pluralDays(days).toUpperCase()}`;

  return (
    <div
      style={{
        background: '#4C5EF0',
        borderRadius: 18,
        padding: 18,
        marginBottom: 24,
      }}
    >
      <div
        className="font-overpass uppercase"
        style={{
          color: '#F9F8FE',
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
          background: '#A1FF4A',
          color: '#060919',
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
