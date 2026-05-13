'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getTelegramId } from '@/lib/auth';

/**
 * Layout для тренерских страниц. Проверяет:
 *   - авторизацию;
 *   - что роль пользователя = COACH; иначе редирект на / или /onboarding/role.
 */
export default function CoachLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const tid = getTelegramId();
      if (!tid) { router.replace('/login'); return; }
      try {
        const res = await fetch('/api/users/me', { cache: 'no-store' });
        if (!res.ok) { router.replace('/login'); return; }
        const data = await res.json();
        if (cancelled) return;

        if (data.role !== 'COACH') {
          // Атлет попал на тренерский урл — отправим на главную
          router.replace('/');
          return;
        }
        if (!data.hasCoachProfile) {
          router.replace('/onboarding/coach');
          return;
        }
        if (!data.activeTeamId) {
          router.replace('/onboarding/coach/team');
          return;
        }
        setIsReady(true);
      } catch {
        router.replace('/login');
      }
    })();
    return () => { cancelled = true; };
  }, [router]);

  if (!isReady) {
    return (
      <div className="min-h-screen bg-[#101530] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#A1FF4A]" />
      </div>
    );
  }

  return <div className="min-h-screen bg-[#101530]">{children}</div>;
}
