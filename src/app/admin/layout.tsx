'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';

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
    // Не проверяем аутентификацию на странице логина
    if (pathname === '/admin/login') {
      setIsAuthenticated(true);
      return;
    }

    // Проверяем аутентификацию для остальных страниц
    const checkAuth = async () => {
      try {
        // Кешируем проверку на 30 секунд, чтобы не проверять при каждом переходе
        const now = Date.now();
        if (authCheckRef.current && now - lastCheckTimeRef.current < 30000) {
          console.log('🔐 Using cached auth check');
          setIsAuthenticated(true);
          return;
        }

        console.log('🔐 Checking admin auth for path:', pathname);
        const response = await fetch('/api/admin/auth', {
          method: 'GET',
          credentials: 'include', // Важно для отправки cookies
        });

        console.log('🔐 Auth response status:', response.status);
        
        if (response.ok) {
          console.log('✅ Admin authenticated');
          authCheckRef.current = true;
          lastCheckTimeRef.current = Date.now();
          setIsAuthenticated(true);
        } else {
          console.log('❌ Admin not authenticated, redirecting to login');
          authCheckRef.current = false;
          setIsAuthenticated(false);
          router.push('/admin/login');
        }
      } catch (error) {
        console.error('Auth check error:', error);
        // Не выходим из системы при ошибке сети - даем еще один шанс
        console.log('⚠️ Network error, assuming authenticated to avoid logout on connection issues');
        setIsAuthenticated(true);
      }
    };

    checkAuth();
  }, [pathname, router]);

  // Показываем загрузку во время проверки аутентификации (только в первый раз)
  if (isAuthenticated === null && pathname !== '/admin/login') {
    return (
      <div className="min-h-screen bg-[#101530] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
          <p className="text-gray-400 mt-4">Загрузка...</p>
        </div>
      </div>
    );
  }

  // Если не авторизован и это не страница логина, не показываем содержимое
  if (isAuthenticated === false && pathname !== '/admin/login') {
    return null;
  }

  return (
    <div className="admin-layout">
      {children}
    </div>
  );
}
