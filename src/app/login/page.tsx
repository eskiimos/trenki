'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { saveAuth } from '@/lib/auth';
import { Button } from '@/components/ui';

// ─────────────────────────────────────────────
// Email-логин: отправка кода и верификация
// ─────────────────────────────────────────────
function EmailLoginForm() {
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [refCode, setRefCode] = useState('');

  // Реф-код из ссылки /r/<code> (положен в localStorage) — префилл поля.
  useEffect(() => {
    try {
      const saved = localStorage.getItem('pendingReferralCode');
      if (saved) setRefCode(saved);
    } catch {}
  }, []);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleSendCode = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/email/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Ошибка отправки');
        return;
      }
      // DEV: сервер возвращает код напрямую (без Resend)
      if (data.devCode) {
        setCode(data.devCode);
        console.log('🔧 DEV LOGIN CODE:', data.devCode);
      }
      setStep('code');
      setCountdown(60);
    } catch {
      setError('Сетевая ошибка. Проверьте подключение.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/email/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code, referralCode: refCode.trim() || undefined }),
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Ошибка проверки кода');
        return;
      }
      try { localStorage.removeItem('pendingReferralCode'); } catch {}
      saveAuth({
        telegramId: data.user.id, // сервер вернул User.id — этого достаточно для UX-кеша
        firstName: data.user.firstName,
        lastName: data.user.lastName,
        username: data.user.username,
      });

      // Если пользователь приходил по приглашению — возвращаем его на /join/CODE
      let pendingJoinCode: string | null = null;
      try {
        pendingJoinCode = localStorage.getItem('pendingJoinCode');
      } catch {}
      if (pendingJoinCode) {
        try {
          localStorage.removeItem('pendingJoinCode');
        } catch {}
        window.location.href = `/join/${pendingJoinCode}`;
        return;
      }

      window.location.href = data.needsOnboarding ? '/onboarding/role' : '/';
    } catch {
      setError('Сетевая ошибка. Проверьте подключение.');
    } finally {
      setLoading(false);
    }
  };

  if (step === 'email') {
    return (
      <div className="flex flex-col gap-4">
        <div>
          <label className="block text-gray-400 text-sm mb-2">Email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !loading && email && handleSendCode()}
            placeholder="example@mail.ru"
            className="w-full bg-[#0A0E1A] text-white border border-[#2a2f4a] rounded-xl px-4 py-3 focus:outline-none focus:border-[#A1FF4A] transition-colors placeholder-gray-600"
            autoComplete="email"
          />
        </div>
        <div>
          <label className="block text-gray-400 text-sm mb-2">Код приглашения <span className="text-gray-600">(если есть)</span></label>
          <input
            type="text"
            value={refCode}
            onChange={e => setRefCode(e.target.value)}
            placeholder="например, лето26"
            className="w-full bg-[#0A0E1A] text-white border border-[#2a2f4a] rounded-xl px-4 py-3 focus:outline-none focus:border-[#A1FF4A] transition-colors placeholder-gray-600"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
        </div>
        <div className="flex flex-col gap-3">
          <label className="flex items-start gap-3 cursor-pointer group">
            <div className="relative mt-0.5 shrink-0">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={e => setAcceptedTerms(e.target.checked)}
                className="sr-only"
              />
              <div
                className="w-5 h-5 rounded border-2 flex items-center justify-center transition-all"
                style={{
                  borderColor: acceptedTerms ? '#A1FF4A' : '#4a4f6a',
                  backgroundColor: acceptedTerms ? '#A1FF4A' : 'transparent',
                }}
              >
                {acceptedTerms && (
                  <svg width="11" height="8" viewBox="0 0 11 8" fill="none">
                    <path d="M1 4L4 7L10 1" stroke="#101530" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
            </div>
            <span className="text-gray-400 text-xs leading-relaxed">
              Я прочитал(а) и согласен(а) с{' '}
              <a href="/legal/terms" target="_blank" className="text-[#A1FF4A] hover:underline">
                пользовательским соглашением
              </a>
            </span>
          </label>

          <label className="flex items-start gap-3 cursor-pointer group">
            <div className="relative mt-0.5 shrink-0">
              <input
                type="checkbox"
                checked={acceptedPrivacy}
                onChange={e => setAcceptedPrivacy(e.target.checked)}
                className="sr-only"
              />
              <div
                className="w-5 h-5 rounded border-2 flex items-center justify-center transition-all"
                style={{
                  borderColor: acceptedPrivacy ? '#A1FF4A' : '#4a4f6a',
                  backgroundColor: acceptedPrivacy ? '#A1FF4A' : 'transparent',
                }}
              >
                {acceptedPrivacy && (
                  <svg width="11" height="8" viewBox="0 0 11 8" fill="none">
                    <path d="M1 4L4 7L10 1" stroke="#101530" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
            </div>
            <span className="text-gray-400 text-xs leading-relaxed">
              Я даю согласие на обработку персональных данных в соответствии с{' '}
              <a href="/legal/privacy" target="_blank" className="text-[#A1FF4A] hover:underline">
                политикой конфиденциальности
              </a>
            </span>
          </label>
        </div>

        {error && (
          <div className="p-3 bg-red-500/20 border border-red-500 rounded-lg">
            <p className="text-red-400 text-sm text-center">{error}</p>
          </div>
        )}
        <Button
          variant="primary"
          fullWidth
          onClick={handleSendCode}
          disabled={loading || !email || !acceptedTerms || !acceptedPrivacy}
          className="flex items-center justify-center gap-2"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <span className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#060919] inline-block"></span> Отправка...
            </span>
          ) : (
            'Отправить код'
          )}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="p-4 bg-[#0A0E1A] border border-[#A1FF4A]/30 rounded-xl">
        <p className="text-gray-400 text-sm text-center">
          Код отправлен на <span className="text-white font-medium">{email}</span>
        </p>
      </div>
      <div>
        <label className="block text-gray-400 text-sm mb-2">Код из письма</label>
        <input
          type="text"
          value={code}
          onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          onKeyDown={e => e.key === 'Enter' && !loading && code.length === 6 && handleVerifyCode()}
          placeholder="000000"
          maxLength={6}
          className="w-full bg-[#0A0E1A] text-white border border-[#2a2f4a] rounded-xl px-4 py-3 text-center text-2xl tracking-[0.5em] font-bold focus:outline-none focus:border-[#A1FF4A] transition-colors placeholder-gray-700"
          autoComplete="one-time-code"
          inputMode="numeric"
          autoFocus
        />
      </div>
      {error && (
        <div className="p-3 bg-red-500/20 border border-red-500 rounded-lg">
          <p className="text-red-400 text-sm text-center">{error}</p>
        </div>
      )}
      <Button
        variant="primary"
        fullWidth
        onClick={handleVerifyCode}
        disabled={loading || code.length < 6}
        className="flex items-center justify-center gap-2"
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <span className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#060919] inline-block"></span> Проверка...
          </span>
        ) : (
          'Войти'
        )}
      </Button>
      <div className="flex items-center justify-between text-sm">
        <button
          onClick={() => {
            setStep('email');
            setCode('');
            setError(null);
          }}
          className="text-gray-500 hover:text-white transition-colors"
        >
          ← Изменить email
        </button>
        {countdown > 0 ? (
          <span className="text-gray-500">Повторить через {countdown}с</span>
        ) : (
          <button onClick={handleSendCode} disabled={loading} className="text-[#A1FF4A] hover:underline">
            Отправить снова
          </button>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Основная страница логина (только Email)
// ─────────────────────────────────────────────
export default function LoginPage() {
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    // Источник истины — серверная подписанная сессия. localStorage кеш может
    // остаться от старого логина и без неё, а middleware такого юзера всё равно
    // вернёт на /login → раньше получался бесконечный цикл «Проверка…».
    (async () => {
      try {
        const res = await fetch('/api/users/me', {
          cache: 'no-store',
          credentials: 'include',
        });
        if (cancelled) return;
        if (res.ok) {
          router.replace('/');
          return;
        }
      } catch {
        // сетевая ошибка — показываем форму, даём пользователю войти заново
      }
      // Сессии нет или она невалидна — стираем устаревший localStorage и показываем форму.
      try {
        localStorage.removeItem('trenki_auth');
      } catch {}
      if (!cancelled) setIsChecking(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (isChecking) {
    return (
      <div className="min-h-screen bg-[#101530] flex flex-col items-center justify-center gap-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#A1FF4A] mx-auto mb-4"></div>
          <p className="text-gray-400">Проверка авторизации...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#101530] flex flex-col items-center justify-center px-6">
      <div className="mb-8 text-center">
        <h1 className="text-white text-6xl font-bold tracking-wider mb-4">ТРЕНЬКИ</h1>
        <p className="text-gray-400 text-lg">Цифровой мир хоккея</p>
      </div>

      <div className="w-full max-w-md bg-[#1a1f3a] rounded-2xl p-8 shadow-2xl">
        <h2 className="text-white text-2xl font-bold text-center mb-6">Вход через Email</h2>
        <EmailLoginForm />
      </div>
    </div>
  );
}
