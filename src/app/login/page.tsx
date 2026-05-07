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
      // 🔧 DEV MODE: сервер вернул код напрямую (нет Resend) — подставим его сразу
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
// Основная страница логина (только Email)
// ─────────────────────────────────────────────
export default function LoginPage() {
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    if (isAuthenticated()) {
      router.push('/');
      return;
    }
    setIsChecking(false);
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
      {/* Логотип */}
      <div className="mb-8 text-center">
        <h1 className="text-white text-6xl font-bold tracking-wider mb-4">ТРЕНЬКИ</h1>
        <p className="text-gray-400 text-lg">Цифровой мир хоккея</p>
      </div>

      {/* Основной контейнер */}
      <div className="w-full max-w-md bg-[#1a1f3a] rounded-2xl p-8 shadow-2xl">
        <h2 className="text-white text-2xl font-bold text-center mb-6">
          Вход через Email
        </h2>

        <EmailLoginForm />
      </div>

      {/* Нижний текст */}
      <div className="mt-8 text-center">
        <p className="text-gray-500 text-xs max-w-md">
          Нажимая кнопку входа, вы соглашаетесь с{' '}
          <a href="/legal/offer" className="text-[#A1FF4A] hover:underline">публичной офертой</a>
          ,{' '}
          <a href="/legal/terms" className="text-[#A1FF4A] hover:underline">пользовательским соглашением</a>
          {' '}и{' '}
          <a href="/legal/privacy" className="text-[#A1FF4A] hover:underline">политикой конфиденциальности</a>
        </p>
      </div>
    </div>
  );
}
