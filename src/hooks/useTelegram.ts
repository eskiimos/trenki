'use client';

import { useEffect, useState } from 'react';
import { getUserData, updateLastLogin } from '@/lib/auth';

/**
 * Бывший Telegram-хук. Telegram-интеграция отключена — оставлен как no-op shim
 * для совместимости со старыми страницами. Возвращает локального юзера из
 * /api/users/me (через lib/auth.ts) и null-ы по Telegram-полям.
 */
export const useTelegram = () => {
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const userData = await getUserData();
      if (cancelled) return;
      if (userData) {
        updateLastLogin();
        setUser(userData);
      }
      setIsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return {
    // Telegram больше не используется. `any` оставлен, чтобы старые места с
    // `webApp.BackButton.show()` компилировались (выполнение защищено `if (webApp)`).
    webApp: null as any,
    user,
    isLoading,
    isTelegramApp: false,
    platform: null as string | null,
  };
};
