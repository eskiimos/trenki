'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { getTelegramId } from '@/lib/auth';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const authCheckRef = useRef<boolean>(false);
  const lastCheckTimeRef = useRef<number>(0);

  useEffect(() => {
    // Страница логина не требует проверки авторизации
    if (pathname === '/admin/login') {
      setIsAuthenticated(true);
      return;
    }

    const checkAuth = async () => {
      try {
        const now = Date.now();
        if (authCheckRef.current && now - lastCheckTimeRef.current < 30000) {
          setIsAuthenticated(true);
          return;
        }

        // Сначала проверяем через Telegram ID (для пользователей-администраторов)
        const telegramId = getTelegramId();
        if (telegramId) {
          const res = await fetch(`/api/user/is-admin?telegramId=${telegramId}`);
          const data = await res.json();
          if (data.isAdmin) {
            authCheckRef.current = true;
            lastCheckTimeRef.current = Date.now();
            setIsAuthenticated(true);
            return;
          }
        }

        // Запасной вариант: проверка по старому cookie (логин/пароль)
        const response = await fetch('/api/admin/auth', {
          method: 'GET',
          credentials: 'include',
        });

        if (response.ok) {
          authCheckRef.current = true;
          lastCheckTimeRef.current = Date.now();
          setIsAuthenticated(true);
        } else {
          authCheckRef.current = false;
          setIsAuthenticated(false);
          router.push('/admin/login');
        }
      } catch {
        setIsAuthenticated(true); // не выбрасываем при ошибке сети
      }
    };

    checkAuth();
  }, [pathname, router]);

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-[#101530] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-gray-400 mt-4">Загрузка...</p>
        </div>
      </div>
    );
  }

  if (isAuthenticated === false) {
    return null;
  }

  return (
    <div className="admin-layout">
      {children}
    </div>
  );
}

