'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    // Не проверяем аутентификацию на странице логина
    if (pathname === '/admin/login') {
      setIsAuthenticated(true);
      return;
    }

    // Проверяем аутентификацию для остальных страниц
    const checkAuth = async () => {
      try {
        console.log('🔐 Checking admin auth for path:', pathname);
        const response = await fetch('/api/admin/auth', {
          method: 'GET',
          credentials: 'include', // Важно для отправки cookies
        });

        console.log('🔐 Auth response status:', response.status);
        
        if (response.ok) {
          console.log('✅ Admin authenticated');
          setIsAuthenticated(true);
        } else {
          console.log('❌ Admin not authenticated, redirecting to login');
          setIsAuthenticated(false);
          router.push('/admin/login');
        }
      } catch (error) {
        console.error('Auth check error:', error);
        setIsAuthenticated(false);
        router.push('/admin/login');
      }
    };

    checkAuth();
  }, [pathname, router]);

  // Показываем загрузку во время проверки аутентификации
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
