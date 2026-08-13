'use client';

// Единственная НЕавторизованная страница админки: сюда попадают по редиректу
// из middleware/layout, поэтому ссылки «назад в админку» (PageHeader) здесь
// быть не должно — только выход в приложение. Вёрстка — на токенах и
// примитивах админки (см. /admin/ui-kit).

import { useState } from 'react';
import Link from 'next/link';
import { AdminPage, AdminCard, AdminButton, inputStyle, labelStyle } from '@/components/admin/ui';
import { AlertCircle, ArrowLeft, Eye, EyeOff, Loader2, ShieldCheck } from 'lucide-react';

export default function AdminLoginPage() {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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
    <AdminPage width="narrow">
      <div
        className="flex flex-col justify-center"
        style={{ minHeight: 'calc(100vh - 64px)', paddingTop: 'var(--safe-top)' }}
      >
        <div style={{ width: '100%', maxWidth: 420, margin: '0 auto' }}>
          {/* Бренд-блок */}
          <div className="flex flex-col items-center text-center" style={{ marginBottom: 24 }}>
            <span
              className="flex items-center justify-center"
              style={{
                width: 48,
                height: 48,
                borderRadius: 999,
                background: 'rgba(161,255,74,0.12)',
                marginBottom: 12,
              }}
            >
              <ShieldCheck size={24} style={{ color: 'var(--color-brand)' }} aria-hidden />
            </span>
            <h1 style={{ fontSize: 24, fontWeight: 800, lineHeight: 1.2, margin: 0 }}>ТРЕНЬКИ</h1>
            <p style={{ fontSize: 13, color: 'var(--color-muted)', margin: '4px 0 0' }}>Админ-панель</p>
          </div>

          {/* Карточка входа */}
          <AdminCard style={{ padding: 24 }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0, textAlign: 'center' }}>
              Вход в админку
            </h2>
            <p
              style={{
                fontSize: 13,
                color: 'var(--color-muted)',
                textAlign: 'center',
                margin: '4px 0 24px',
              }}
            >
              Введите логин и пароль для доступа к админ-панели
            </p>

            {error && (
              <div
                role="alert"
                className="flex items-start gap-2"
                style={{
                  marginBottom: 16,
                  padding: 12,
                  borderRadius: 'var(--radius-sm)',
                  background: 'rgba(255,140,74,0.12)',
                  border: '1px solid rgba(255,140,74,0.30)',
                }}
              >
                <AlertCircle
                  size={20}
                  style={{ color: 'var(--color-danger)', flexShrink: 0 }}
                  aria-hidden
                />
                <span style={{ fontSize: 13, color: 'var(--color-danger)' }}>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Логин */}
              <div>
                <label htmlFor="login" style={labelStyle}>
                  Логин
                </label>
                <input
                  id="login"
                  type="text"
                  autoComplete="username"
                  autoFocus
                  value={login}
                  onChange={(e) => setLogin(e.target.value)}
                  placeholder="Введите логин"
                  disabled={isLoading}
                  style={inputStyle}
                  required
                />
              </div>

              {/* Пароль */}
              <div>
                <label htmlFor="password" style={labelStyle}>
                  Пароль
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Введите пароль"
                    disabled={isLoading}
                    style={{ ...inputStyle, paddingRight: 48 }}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                    className="absolute inline-flex items-center justify-center"
                    style={{
                      top: 0,
                      right: 0,
                      width: 44,
                      height: 44,
                      background: 'none',
                      border: 'none',
                      color: 'var(--color-muted)',
                      cursor: 'pointer',
                    }}
                  >
                    {showPassword ? <EyeOff size={20} aria-hidden /> : <Eye size={20} aria-hidden />}
                  </button>
                </div>
              </div>

              {/* Кнопка входа */}
              <AdminButton
                type="submit"
                disabled={isLoading || !login || !password}
                style={{ width: '100%', marginTop: 8 }}
              >
                {isLoading ? (
                  <>
                    <Loader2 size={20} className="animate-spin" aria-hidden />
                    Вход…
                  </>
                ) : (
                  'Войти'
                )}
              </AdminButton>
            </form>

            <div
              style={{
                marginTop: 24,
                paddingTop: 16,
                borderTop: '1px solid var(--border-hairline)',
              }}
            >
              <p style={{ fontSize: 12, color: 'var(--color-muted)', textAlign: 'center', margin: 0 }}>
                Доступ выдаёт администратор системы
              </p>
            </div>
          </AdminCard>

          {/* Выход в приложение */}
          <div className="text-center" style={{ marginTop: 24 }}>
            <Link
              href="/"
              className="inline-flex items-center gap-2 transition-opacity hover:opacity-70"
              style={{ color: 'var(--color-brand)', fontSize: 13 }}
            >
              <ArrowLeft size={16} aria-hidden />
              Вернуться на главную
            </Link>
          </div>
        </div>
      </div>
    </AdminPage>
  );
}
