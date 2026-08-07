'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { invalidateSubscription } from '@/hooks/useSubscription';

// Возврат после оплаты T-Bank. Опрашиваем /api/payments/status (подстраховка к
// вебхуку) до подтверждения, затем сбрасываем кэш статуса подписки.
function SuccessInner() {
  const params = useSearchParams();
  const orderId = params.get('orderId');
  // back=parent ставит /api/payments/init при оплате родителем за ребёнка —
  // родителя возвращаем в родительский кабинет, а не в атлетский профиль.
  const backToParent = params.get('back') === 'parent';
  const [state, setState] = useState<'checking' | 'paid' | 'pending'>('checking');

  useEffect(() => {
    if (!orderId) {
      setState('pending');
      return;
    }
    let stopped = false;
    let tries = 0;
    const poll = async () => {
      tries += 1;
      try {
        const res = await fetch(`/api/payments/status?orderId=${encodeURIComponent(orderId)}`);
        const d = await res.json().catch(() => ({}));
        // Успех — ТОЛЬКО если подтверждён ИМЕННО этот заказ (d.paid), а не любой
        // уже имеющийся премиум (иначе отменённая оплата у премиум-юзера показала бы «успех»).
        if (!stopped && d.paid) {
          invalidateSubscription();
          setState('paid');
          return;
        }
      } catch {
        /* повторим */
      }
      if (!stopped) {
        if (tries < 20) setTimeout(poll, 3000);
        else setState('pending');
      }
    };
    poll();
    return () => {
      stopped = true;
    };
  }, [orderId]);

  const card: React.CSSProperties = {
    maxWidth: 420,
    margin: '0 auto',
    padding: 24,
    textAlign: 'center',
  };

  return (
    <div style={{ background: '#101530', minHeight: '100vh', color: '#F9F8FE', display: 'flex', alignItems: 'center' }}>
      <div style={card}>
        {state === 'checking' && (
          <>
            <div style={{ fontSize: 40, marginBottom: 12 }}>⏳</div>
            <h1 className="font-overpass uppercase" style={{ fontWeight: 900, fontSize: 22 }}>Проверяем оплату…</h1>
            <p style={{ color: '#AEABBB', fontSize: 14, marginTop: 8 }}>Это займёт несколько секунд.</p>
          </>
        )}
        {state === 'paid' && (
          <>
            <div style={{ fontSize: 44, marginBottom: 12 }}>🎉</div>
            <h1 className="font-overpass uppercase" style={{ fontWeight: 900, fontSize: 22, color: '#A1FF4A' }}>
              Подписка активна
            </h1>
            <p style={{ color: '#AEABBB', fontSize: 14, marginTop: 8 }}>Доступ ко всем возможностям открыт.</p>
          </>
        )}
        {state === 'pending' && (
          <>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
            <h1 className="font-overpass uppercase" style={{ fontWeight: 900, fontSize: 20 }}>Оплата принята</h1>
            <p style={{ color: '#AEABBB', fontSize: 14, marginTop: 8 }}>
              Премиум появится в течение минуты. Можно обновить профиль позже.
            </p>
          </>
        )}
        <Link
          href={backToParent ? '/parent' : '/profile'}
          className="font-overpass uppercase"
          style={{
            display: 'inline-block',
            marginTop: 24,
            background: '#A1FF4A',
            color: '#060919',
            borderRadius: 999,
            padding: '13px 26px',
            fontWeight: 900,
            fontSize: 14,
            textDecoration: 'none',
          }}
        >
          {backToParent ? 'Вернуться в кабинет' : 'В профиль'}
        </Link>
      </div>
    </div>
  );
}

export default function SubscriptionSuccessPage() {
  return (
    <Suspense fallback={<div style={{ background: '#101530', minHeight: '100vh' }} />}>
      <SuccessInner />
    </Suspense>
  );
}
