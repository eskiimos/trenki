'use client';

// Лендинг реферальной ссылки: trenki.app/r/<code>. Публичный (см. middleware
// publicRoutes '/r'). Проверяет код, кладёт его в localStorage
// (pendingReferralCode) и ведёт на вход; после регистрации verify-code привяжет
// код к новому пользователю (User.referralCode).

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

export default function ReferralLandingPage() {
  const params = useParams<{ code: string }>();
  const code = params?.code ? decodeURIComponent(params.code) : '';
  const [status, setStatus] = useState<'loading' | 'valid' | 'invalid'>('loading');
  const [label, setLabel] = useState<string>('');

  useEffect(() => {
    if (!code) { setStatus('invalid'); return; }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/referral/validate?code=${encodeURIComponent(code)}`);
        const d = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (d?.valid) {
          // Кладём РУССКИЙ промокод (как на флаере); verify-code привяжет канонический.
          try { localStorage.setItem('pendingReferralCode', d.promo || d.code); } catch {}
          setLabel(d.label || '');
          setStatus('valid');
        } else {
          setStatus('invalid');
        }
      } catch {
        if (!cancelled) setStatus('invalid');
      }
    })();
    return () => { cancelled = true; };
  }, [code]);

  const go = () => { window.location.href = '/login'; };

  return (
    <div style={{ minHeight: '100vh', background: '#060919', color: '#F9F8FE', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ maxWidth: 360, width: '100%', textAlign: 'center' }}>
        {status === 'loading' && (
          <div className="font-overpass" style={{ color: '#AEABBB', fontSize: 14 }}>Проверяем приглашение…</div>
        )}

        {status === 'valid' && (
          <>
            <div className="font-overpass uppercase" style={{ color: '#A1FF4A', fontSize: 12, fontWeight: 800, letterSpacing: '0.18em', marginBottom: 12 }}>
              Приглашение
            </div>
            <div className="font-overpass uppercase" style={{ fontSize: 26, fontWeight: 900, lineHeight: 1.05, marginBottom: 12 }}>
              {label}
            </div>
            <p className="font-overpass" style={{ color: '#AEABBB', fontSize: 14, marginBottom: 28 }}>
              Зарегистрируйся — и попадёшь к нам по приглашению «{label}».
            </p>
            <button
              onClick={go}
              className="font-overpass uppercase"
              style={{ width: '100%', background: '#A1FF4A', color: '#060919', borderRadius: 999, padding: '16px', fontWeight: 900, fontSize: 15, border: 'none', letterSpacing: '0.04em' }}
            >
              Продолжить
            </button>
          </>
        )}

        {status === 'invalid' && (
          <>
            <div className="font-overpass uppercase" style={{ fontSize: 20, fontWeight: 900, marginBottom: 10 }}>
              Код не найден
            </div>
            <p className="font-overpass" style={{ color: '#AEABBB', fontSize: 14, marginBottom: 28 }}>
              Приглашение неактивно или введено с ошибкой. Можно зарегистрироваться и без него.
            </p>
            <button
              onClick={go}
              className="font-overpass uppercase"
              style={{ width: '100%', background: 'rgba(174,171,187,0.18)', color: '#F9F8FE', borderRadius: 999, padding: '16px', fontWeight: 800, fontSize: 14, border: '1px solid rgba(174,171,187,0.25)' }}
            >
              Войти
            </button>
          </>
        )}
      </div>
    </div>
  );
}
