'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { getTelegramId } from '@/lib/auth';

type JoinState = 'loading' | 'success' | 'pending' | 'error' | 'auth-required';

export default function JoinTeamPage({ params }: { params: Promise<{ code: string }> }) {
  const router = useRouter();
  const { code } = use(params);
  const [state, setState] = useState<JoinState>('loading');
  const [teamName, setTeamName] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');

  useEffect(() => {
    (async () => {
      const tid = getTelegramId();
      if (!tid) {
        // Сохраняем код в localStorage, чтобы после логина вернуть
        try { localStorage.setItem('pendingJoinCode', code); } catch { }
        setState('auth-required');
        return;
      }
      try {
        const res = await fetch('/api/teams/join', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: code.toUpperCase() }),
        });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          setErrorMsg(d?.error || 'Не удалось присоединиться');
          setState('error');
          return;
        }
        const data = await res.json();
        setTeamName(data.team?.name ?? 'Команда');
        // Сервер вернёт status='ACTIVE' (уже в команде) или 'PENDING' (заявка ждёт тренера).
        setState(data.status === 'ACTIVE' ? 'success' : 'pending');
      } catch {
        setErrorMsg('Сетевая ошибка');
        setState('error');
      }
    })();
  }, [code]);

  return (
    <div className="min-h-screen bg-[#101530] text-white flex flex-col items-center justify-center px-6 max-w-3xl md:mx-auto md:px-8">
      {state === 'loading' && (
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#A1FF4A]" />
      )}

      {state === 'auth-required' && (
        <>
          <h1 className="font-overpass uppercase text-center" style={{ fontWeight: 900, fontSize: 22 }}>
            Нужно войти
          </h1>
          <p className="font-overpass mt-3 text-center" style={{ color: '#AEABBB', fontSize: 14 }}>
            Войди в аккаунт, и мы сразу присоединим тебя к команде по коду <b style={{ color: '#A1FF4A' }}>{code.toUpperCase()}</b>.
          </p>
          <button
            onClick={() => router.push('/login')}
            className="mt-6 font-overpass uppercase"
            style={{
              background: '#A1FF4A',
              color: '#101530',
              padding: '14px 28px',
              borderRadius: 999,
              fontWeight: 900,
              fontSize: 13,
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Войти
          </button>
        </>
      )}

      {state === 'pending' && (
        <>
          <div
            style={{
              width: 88,
              height: 88,
              borderRadius: '50%',
              background: 'rgba(161, 255, 74, 0.15)',
              border: '2px solid rgba(161, 255, 74, 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 20,
            }}
          >
            <svg width="42" height="42" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9" stroke="#A1FF4A" strokeWidth="2" />
              <path d="M12 7v5l3 2" stroke="#A1FF4A" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
          <h1 className="font-overpass uppercase text-center" style={{ fontWeight: 900, fontSize: 22 }}>
            Заявка отправлена
          </h1>
          <p className="font-overpass mt-2 text-center" style={{ color: '#AEABBB', fontSize: 14, maxWidth: 320 }}>
            Тренер «{teamName}» подтвердит твоё вступление. После этого тебе придёт уведомление.
          </p>
          <button
            onClick={() => router.push('/')}
            className="mt-7 font-overpass uppercase"
            style={{
              background: '#A1FF4A',
              color: '#101530',
              padding: '14px 28px',
              borderRadius: 999,
              fontWeight: 900,
              fontSize: 13,
              border: 'none',
              cursor: 'pointer',
            }}
          >
            На главную
          </button>
        </>
      )}

      {state === 'success' && (
        <>
          <div
            style={{
              width: 88,
              height: 88,
              borderRadius: '50%',
              background: '#A1FF4A',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 20,
            }}
          >
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
              <path d="M5 13l4 4L19 7" stroke="#101530" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h1 className="font-overpass uppercase text-center" style={{ fontWeight: 900, fontSize: 22 }}>
            Ты в команде
          </h1>
          <p className="font-overpass mt-2 text-center" style={{ color: '#AEABBB', fontSize: 14 }}>
            «{teamName}»
          </p>
          <button
            onClick={() => router.push('/')}
            className="mt-7 font-overpass uppercase"
            style={{
              background: '#A1FF4A',
              color: '#101530',
              padding: '14px 28px',
              borderRadius: 999,
              fontWeight: 900,
              fontSize: 13,
              border: 'none',
              cursor: 'pointer',
            }}
          >
            На главную
          </button>
        </>
      )}

      {state === 'error' && (
        <>
          <h1 className="font-overpass uppercase text-center" style={{ fontWeight: 900, fontSize: 22 }}>
            Ошибка
          </h1>
          <p className="font-overpass mt-3 text-center" style={{ color: '#AEABBB', fontSize: 14 }}>
            {errorMsg}
          </p>
          <button
            onClick={() => router.push('/')}
            className="mt-6 font-overpass uppercase"
            style={{
              background: 'transparent',
              color: '#F9F8FE',
              border: '1px solid #26252F',
              padding: '12px 24px',
              borderRadius: 999,
              fontWeight: 800,
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            На главную
          </button>
        </>
      )}
    </div>
  );
}
