'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { clearAuth } from '@/lib/auth';

export default function ClearCachePage() {
  const router = useRouter();
  const [status, setStatus] = useState('Очистка кэша...');

  useEffect(() => {
    const clearEverything = async () => {
      try {
        // 1. Очистить auth данные (httpOnly cookie снимает сервер /api/auth/logout)
        await clearAuth();
        setStatus('✅ Auth очищен');

        // 2. Очистить весь localStorage
        localStorage.clear();
        setStatus('✅ localStorage очищен');

        // 3. Очистить все cookies
        document.cookie.split(";").forEach((c) => {
          document.cookie = c
            .replace(/^ +/, "")
            .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
        });
        setStatus('✅ Cookies очищены');

        // 4. Очистить Service Worker кэш
        if ('caches' in window) {
          const cacheNames = await caches.keys();
          await Promise.all(cacheNames.map(name => caches.delete(name)));
          setStatus('✅ Service Worker кэш очищен');
        }

        setStatus('✅ Всё очищено! Перенаправление...');

        // 5. Перенаправить на логин через 2 секунды
        setTimeout(() => {
          window.location.href = '/login';
        }, 2000);

      } catch (error) {
        console.error('Ошибка при очистке:', error);
        setStatus('❌ Ошибка: ' + (error as Error).message);
      }
    };

    clearEverything();
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#1a1a2e] text-white">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">Очистка кэша</h1>
        <p className="text-lg">{status}</p>
      </div>
    </div>
  );
}
