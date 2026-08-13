'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, RefreshCw } from 'lucide-react';

export default function AdminLogoutButton() {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await fetch('/api/admin/auth', {
        method: 'DELETE',
      });
      router.push('/admin/login');
    } catch (error) {
      console.error('Logout error:', error);
      setIsLoggingOut(false);
    }
  };

  return (
    <button
      onClick={handleLogout}
      disabled={isLoggingOut}
      className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white rounded-lg text-sm font-semibold transition-colors inline-flex items-center gap-2"
      title="Выйти из админки"
    >
      {isLoggingOut ? (
        <>
          <RefreshCw size={20} className="animate-spin" aria-hidden />
          Выход...
        </>
      ) : (
        <>
          <LogOut size={20} aria-hidden />
          Выйти
        </>
      )}
    </button>
  );
}
