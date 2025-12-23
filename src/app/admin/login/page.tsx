'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function AdminLoginPage() {
  const router = useRouter();
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ login, password }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || 'Неверные учетные данные');
        setIsLoading(false);
        return;
      }

      // Успешный вход - используем window.location для hard redirect
      // это гарантирует, что cookie будет установлен перед проверкой
      window.location.href = '/admin';
    } catch (err) {
      console.error('Login error:', err);
      setError('Ошибка при попытке входа');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0e1a] to-[#1a1f3a] text-white flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Логотип/Заголовок */}
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-2">ТРЕНЬКИ</h1>
          <p className="text-gray-400">Админ-панель</p>
        </div>

        {/* Карточка входа */}
        <div className="bg-[#1a1f3a] rounded-2xl p-8 border border-white/10">
          <h2 className="text-2xl font-bold mb-2 text-center">Вход в админку</h2>
          <p className="text-gray-400 text-sm text-center mb-6">
            Введите логин и пароль для доступа к админ-панели
          </p>

          {error && (
            <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-lg">
              <p className="text-red-200 text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Логин */}
            <div>
              <label htmlFor="login" className="block text-sm font-medium mb-2">
                Логин
              </label>
              <input
                id="login"
                type="text"
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                placeholder="Введите логин"
                disabled={isLoading}
                className="w-full px-4 py-3 bg-[#0a0e1a] border border-white/20 rounded-lg focus:border-blue-500 focus:outline-none transition-colors disabled:opacity-50"
                required
              />
            </div>

            {/* Пароль */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-2">
                Пароль
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Введите пароль"
                disabled={isLoading}
                className="w-full px-4 py-3 bg-[#0a0e1a] border border-white/20 rounded-lg focus:border-blue-500 focus:outline-none transition-colors disabled:opacity-50"
                required
              />
            </div>

            {/* Кнопка входа */}
            <button
              type="submit"
              disabled={isLoading || !login || !password}
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-semibold transition-colors mt-6"
            >
              {isLoading ? 'Вход...' : 'Войти'}
            </button>
          </form>

          {/* Информация */}
          <div className="mt-6 pt-6 border-t border-white/10">
            <p className="text-xs text-gray-400 text-center">
              Учетные данные админа находятся в переменной окружения <code className="bg-black/50 px-2 py-1 rounded">ADMIN_LOGIN</code> и <code className="bg-black/50 px-2 py-1 rounded">ADMIN_PASSWORD</code>
            </p>
          </div>
        </div>

        {/* Ссылка на главную */}
        <div className="mt-6 text-center">
          <Link href="/" className="inline-block text-blue-400 hover:text-blue-300 text-sm transition-colors">
            ← Вернуться на главную
          </Link>
        </div>
      </div>
    </div>
  );
}
