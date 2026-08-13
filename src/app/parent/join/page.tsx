'use client';

// Погашение родительского инвайта: /parent/join?code=XXXXXXXX.
// Без сессии код сохраняется в localStorage ('trenki_parent_join_code') и юзер
// уходит на /login — после входа login-страница возвращает его сюда с кодом.
// С сессией — POST /api/parent/join и редирект в кабинет /parent.

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Frown } from 'lucide-react';
import { Button } from '@/components/ui';

const JOIN_CODE_STORAGE_KEY = 'trenki_parent_join_code';

function ParentJoinInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return; // strict-mode double-mount: код гасим один раз
    startedRef.current = true;

    const run = async () => {
      let code = (searchParams.get('code') || '').trim();
      if (!code) {
        try {
          code = localStorage.getItem(JOIN_CODE_STORAGE_KEY) || '';
        } catch {}
      }
      if (!code) {
        setError('В ссылке нет кода приглашения. Попроси ребёнка прислать ссылку ещё раз.');
        return;
      }

      // Есть ли сессия? Без неё — сохраняем код и на /login (после входа вернёмся).
      try {
        const me = await fetch('/api/users/me', { cache: 'no-store', credentials: 'include' });
        if (me.status === 401) {
          try {
            localStorage.setItem(JOIN_CODE_STORAGE_KEY, code);
          } catch {}
          router.replace('/login');
          return;
        }
      } catch {
        setError('Сетевая ошибка. Проверь подключение и открой ссылку ещё раз.');
        return;
      }

      try {
        const res = await fetch('/api/parent/join', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ code }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.error || 'Не удалось активировать приглашение');
          return;
        }
        try {
          localStorage.removeItem(JOIN_CODE_STORAGE_KEY);
        } catch {}
        router.replace('/parent');
      } catch {
        setError('Сетевая ошибка. Проверь подключение и попробуй ещё раз.');
      }
    };

    run();
  }, [router, searchParams]);

  if (error) {
    return (
      <div className="min-h-screen bg-night flex flex-col items-center justify-center px-6">
        <div className="w-full max-w-md bg-surface rounded-2xl p-8 text-center">
          <Frown size={40} className="text-muted mx-auto mb-4" aria-hidden />
          <h1 className="text-white text-xl font-bold mb-3">Не получилось</h1>
          <p className="text-muted text-sm mb-6">{error}</p>
          <Button variant="primary" fullWidth onClick={() => router.replace('/')}>
            На главную
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-night flex flex-col items-center justify-center gap-4">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand" />
      <p className="text-muted">Активируем приглашение…</p>
    </div>
  );
}

export default function ParentJoinPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-night flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand" />
        </div>
      }
    >
      <ParentJoinInner />
    </Suspense>
  );
}
