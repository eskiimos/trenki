'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { isAuthenticated, saveAuth } from '@/lib/auth';

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
        body: JSON.stringify({ email, code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Ошибка проверки кода');
        return;
      }
      saveAuth({
        telegramId: data.user.telegramId,
        firstName: data.user.firstName,
        lastName: data.user.lastName,
        username: data.user.username,
      });
      window.location.href = data.needsOnboarding ? '/onboarding' : '/';
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
        {error && (
          <div className="p-3 bg-red-500/20 border border-red-500 rounded-lg">
            <p className="text-red-400 text-sm text-center">{error}</p>
          </div>
        )}
        <button
          onClick={handleSendCode}
          disabled={loading || !email}
          className="w-full bg-[#A1FF4A] hover:bg-[#8fe63a] disabled:bg-gray-600 disabled:cursor-not-allowed text-[#101530] font-bold py-4 px-6 rounded-xl flex items-center justify-center gap-2 transition-all"
        >
          {loading ? (
            <span className="flex items-center gap-2"><span className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#101530] inline-block"></span> Отправка...</span>
          ) : (
            'Отправить код'
          )}
        </button>
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
      <button
        onClick={handleVerifyCode}
        disabled={loading || code.length < 6}
        className="w-full bg-[#A1FF4A] hover:bg-[#8fe63a] disabled:bg-gray-600 disabled:cursor-not-allowed text-[#101530] font-bold py-4 px-6 rounded-xl flex items-center justify-center gap-2 transition-all"
      >
        {loading ? (
          <span className="flex items-center gap-2"><span className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#101530] inline-block"></span> Проверка...</span>
        ) : (
          'Войти'
        )}
      </button>
      <div className="flex items-center justify-between text-sm">
        <button
          onClick={() => { setStep('email'); setCode(''); setError(null); }}
          className="text-gray-500 hover:text-white transition-colors"
        >
          ← Изменить email
        </button>
        {countdown > 0 ? (
          <span className="text-gray-500">Повторить через {countdown}с</span>
        ) : (
          <button
            onClick={handleSendCode}
            disabled={loading}
            className="text-[#A1FF4A] hover:underline"
          >
            Отправить снова
          </button>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Основная страница логина
// ─────────────────────────────────────────────
export default function LoginPage() {
  const router = useRouter();
  const [tab, setTab] = useState<'telegram' | 'email'>('telegram');
  const [isChecking, setIsChecking] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loginToken, setLoginToken] = useState<string | null>(null);

  const createLoginToken = async () => {
    const response = await fetch('/api/auth/create-login-token', { method: 'POST' });
    if (!response.ok) throw new Error('Failed to create login token');
    const data = await response.json();
    return data.token;
  };

  const checkLoginStatus = async (token: string) => {
    try {
      const response = await fetch(`/api/auth/check-login-token?token=${token}`);
      if (!response.ok) return null;
      const data = await response.json();
      if (data.authenticated && data.user) {
        localStorage.removeItem('pendingLoginToken');
        saveAuth({
          telegramId: data.user.telegramId,
          firstName: data.user.firstName,
          lastName: data.user.lastName,
          username: data.user.username,
        });
        setTimeout(() => {
          window.location.href = data.needsOnboarding ? '/onboarding' : '/';
        }, 100);
        return true;
      }
      return false;
    } catch {
      return null;
    }
  };

  const resumeLoginCheck = (token: string) => {
    let attempts = 0;
    const maxAttempts = 150;
    const intervalId = setInterval(async () => {
      attempts++;
      const authenticated = await checkLoginStatus(token);
      if (authenticated) {
        clearInterval(intervalId);
        setIsLoggingIn(false);
      } else if (authenticated === null) {
        clearInterval(intervalId);
        setIsLoggingIn(false);
        localStorage.removeItem('pendingLoginToken');
        setError('Токен истёк. Попробуйте войти снова.');
      } else if (attempts >= maxAttempts) {
        clearInterval(intervalId);
        setIsLoggingIn(false);
        localStorage.removeItem('pendingLoginToken');
        setError('Время ожидания истекло. Попробуйте снова.');
      }
    }, 2000);
  };

  useEffect(() => {
    const checkAuthAndToken = () => {
      if (isAuthenticated()) {
        router.push('/');
        return;
      }
      const savedToken = localStorage.getItem('pendingLoginToken');
      if (savedToken) {
        setLoginToken(savedToken);
        setIsLoggingIn(true);
        setIsChecking(false);
        resumeLoginCheck(savedToken);
      } else {
        setIsChecking(false);
      }
    };
    checkAuthAndToken();
    const handleVisibilityChange = () => {
      if (!document.hidden) checkAuthAndToken();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [router]);

  const handleTelegramLogin = async () => {
    setIsLoggingIn(true);
    setError(null);
    try {
      const token = await createLoginToken();
      setLoginToken(token);
      localStorage.setItem('pendingLoginToken', token);
      const link = document.createElement('a');
      link.href = `https://t.me/trenkiapp_bot?start=${token}`;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      resumeLoginCheck(token);
    } catch {
      setError('Ошибка входа. Попробуйте снова.');
      setIsLoggingIn(false);
      localStorage.removeItem('pendingLoginToken');
    }
  };

  if (isChecking) {
    return (
      <div className="min-h-screen bg-[#101530] flex flex-col items-center justify-center gap-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#A1FF4A] mx-auto mb-4"></div>
          <p className="text-gray-400">Проверка авторизации...</p>
        </div>
        <button
          onClick={() => {
            localStorage.removeItem('pendingLoginToken');
            localStorage.removeItem('telegramId');
            setIsChecking(false);
            setIsLoggingIn(false);
            setError(null);
          }}
          className="text-gray-500 text-sm hover:text-white transition-colors"
        >
          Сбросить состояние
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#101530] flex flex-col items-center justify-center px-6">
      {/* Логотип */}
      <div className="mb-8 text-center">
        <h1 className="text-white text-6xl font-bold tracking-wider mb-4">ТРЕНЬКИ</h1>
        <p className="text-gray-400 text-lg">Цифровой мир хоккея</p>
      </div>

      {/* Основной контейнер */}
      <div className="w-full max-w-md bg-[#1a1f3a] rounded-2xl p-8 shadow-2xl">
        <h2 className="text-white text-2xl font-bold text-center mb-6">
          Вход в приложение
        </h2>

        {/* Вкладки */}
        <div className="flex bg-[#0A0E1A] rounded-xl p-1 mb-6">
          <button
            onClick={() => setTab('telegram')}
            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${
              tab === 'telegram'
                ? 'bg-[#0088cc] text-white shadow'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Telegram
          </button>
          <button
            onClick={() => setTab('email')}
            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${
              tab === 'email'
                ? 'bg-[#A1FF4A] text-[#101530] shadow'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Email
          </button>
        </div>

        {/* Email */}
        {tab === 'email' && <EmailLoginForm />}

        {/* Telegram */}
        {tab === 'telegram' && (
          <div className="flex flex-col items-center gap-4">
            {!isLoggingIn ? (
              <button
                onClick={handleTelegramLogin}
                className="w-full bg-[#0088cc] hover:bg-[#006699] text-white font-bold py-4 px-6 rounded-xl flex items-center justify-center gap-3 transition-all shadow-lg"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.27-.02-.12.03-1.99 1.27-5.62 3.73-.53.36-1.01.54-1.44.53-.47-.01-1.38-.27-2.06-.49-.83-.27-1.49-.42-1.43-.88.03-.24.38-.48.9-.72 3.55-1.55 5.93-2.57 7.14-3.07 3.4-1.42 4.1-1.67 4.57-1.67.1 0 .33.02.48.14.12.1.15.24.17.34-.01.1.01.24 0 .35z" />
                </svg>
                Вход через Telegram
              </button>
            ) : (
              <button
                disabled
                className="w-full bg-gray-600 cursor-not-allowed text-white font-bold py-4 px-6 rounded-xl flex items-center justify-center gap-3"
              >
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Ожидание подтверждения...
              </button>
            )}

            {isLoggingIn && loginToken && (
              <div className="w-full space-y-3">
                <div className="p-6 bg-[#0A0E1A] border border-[#A1FF4A] rounded-xl">
                  <div className="flex items-center gap-4 mb-3">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#A1FF4A]"></div>
                    <div className="flex-1">
                      <p className="text-white font-medium mb-1">Откройте Telegram</p>
                      <p className="text-gray-400 text-sm">
                        Нажмите «Старт» в боте для подтверждения входа
                      </p>
                    </div>
                  </div>
                  <a
                    href={`https://t.me/trenkiapp_bot?start=${loginToken}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full text-center py-2 px-4 bg-[#0088cc] hover:bg-[#006699] text-white text-sm rounded-lg transition-colors"
                  >
                    Открыть бота вручную
                  </a>
                </div>
                <button
                  onClick={() => {
                    setIsLoggingIn(false);
                    setLoginToken(null);
                    localStorage.removeItem('pendingLoginToken');
                    setError(null);
                  }}
                  className="w-full py-3 text-gray-400 hover:text-white text-sm transition-colors"
                >
                  Отменить
                </button>
              </div>
            )}

            {error && (
              <div className="w-full p-4 bg-red-500/20 border border-red-500 rounded-lg">
                <p className="text-red-400 text-sm text-center">{error}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Нижний текст */}
      <div className="mt-8 text-center">
        <p className="text-gray-500 text-xs max-w-md">
          Нажимая кнопку входа, вы соглашаетесь с{' '}
          <a href="/terms" className="text-[#A1FF4A] hover:underline">условиями использования</a>
          {' '}и{' '}
          <a href="/privacy" className="text-[#A1FF4A] hover:underline">политикой конфиденциальности</a>
        </p>
      </div>
    </div>
  );
}
