'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function AdaptiveLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSendCode = async () => {
    if (!email) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/email/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Ошибка отправки'); return; }
      setStep('code');
    } catch {
      setError('Сетевая ошибка.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!code) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/email/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Неверный код'); return; }
      router.push('/adaptive/dashboard');
    } catch {
      setError('Сетевая ошибка.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#060919] text-white flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        {/* Лого */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-full bg-blue-600 flex items-center justify-center text-2xl font-bold mx-auto mb-3">А</div>
          <h1 className="text-2xl font-bold">АДАПТИВ</h1>
          <p className="text-gray-400 text-sm mt-1">Адаптивный спорт</p>
        </div>

        <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
          <h2 className="font-semibold text-lg mb-1">Вход</h2>
          <p className="text-gray-400 text-sm mb-5">
            {step === 'email' ? 'Введите email для получения кода' : `Код отправлен на ${email}`}
          </p>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
              {error}
            </div>
          )}

          {step === 'email' ? (
            <>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendCode()}
                placeholder="your@email.com"
                className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 focus:outline-none focus:border-blue-500 text-white placeholder-gray-500 mb-4"
              />
              <button
                onClick={handleSendCode}
                disabled={loading || !email}
                className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 font-semibold disabled:opacity-50 transition-colors"
              >
                {loading ? 'Отправка...' : 'Получить код'}
              </button>
            </>
          ) : (
            <>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleVerifyCode()}
                placeholder="Код из письма"
                maxLength={6}
                className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 focus:outline-none focus:border-blue-500 text-white placeholder-gray-500 mb-4 text-center text-xl tracking-widest"
              />
              <button
                onClick={handleVerifyCode}
                disabled={loading || !code}
                className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 font-semibold disabled:opacity-50 transition-colors mb-3"
              >
                {loading ? 'Проверка...' : 'Войти'}
              </button>
              <button
                onClick={() => { setStep('email'); setCode(''); setError(null); }}
                className="w-full text-sm text-gray-400 hover:text-white transition-colors"
              >
                Изменить email
              </button>
            </>
          )}
        </div>

        <p className="text-center text-xs text-gray-600 mt-6">
          <Link href="/" className="hover:text-gray-400 transition-colors">
            ← Вернуться на trenki.app
          </Link>
        </p>
      </div>
    </div>
  );
}
