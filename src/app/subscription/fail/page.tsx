'use client';

import Link from 'next/link';
import { Frown } from 'lucide-react';

// Возврат при неуспешной/отменённой оплате T-Bank.
export default function SubscriptionFailPage() {
  return (
    <div style={{ background: '#101530', minHeight: '100vh', color: '#F9F8FE', display: 'flex', alignItems: 'center' }}>
      <div style={{ maxWidth: 420, margin: '0 auto', padding: 24, textAlign: 'center' }}>
        <Frown size={44} color="#AEABBB" style={{ margin: '0 auto 12px' }} aria-hidden />
        <h1 className="font-overpass uppercase" style={{ fontWeight: 900, fontSize: 22 }}>Оплата не прошла</h1>
        <p style={{ color: '#AEABBB', fontSize: 14, marginTop: 8 }}>
          Платёж отменён или отклонён. Деньги не списаны — можно попробовать снова.
        </p>
        <Link
          href="/profile"
          className="font-overpass uppercase"
          style={{
            display: 'inline-block',
            marginTop: 24,
            background: '#2d3448',
            color: '#F9F8FE',
            borderRadius: 999,
            padding: '13px 26px',
            fontWeight: 900,
            fontSize: 14,
            textDecoration: 'none',
          }}
        >
          Вернуться
        </Link>
      </div>
    </div>
  );
}
