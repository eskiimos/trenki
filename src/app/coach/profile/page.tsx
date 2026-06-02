'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import BottomNavigationCoach from '@/components/BottomNavigationCoach';
import { clearAuth } from '@/lib/auth';
import AccountSwitcher from '@/components/AccountSwitcher';
import InviteCodeSection from '@/components/coach/InviteCodeSection';

interface MeData {
  firstName: string;
  lastName: string;
  coachClubName: string | null;
}

export default function CoachProfilePage() {
  const router = useRouter();
  const [me, setMe] = useState<MeData | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch('/api/users/me', { cache: 'no-store' });
      if (res.ok) setMe(await res.json());
    })();
  }, []);

  const handleLogout = async () => {
    if (confirm('Выйти из аккаунта?')) {
      await clearAuth();
      router.push('/login');
    }
  };

  return (
    <div className="min-h-screen bg-[#101530] text-white pb-24">
      <div
        className="px-5 pb-6 max-w-3xl md:mx-auto md:px-8"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 24px)' }}
      >
        <h1 className="font-overpass uppercase" style={{ fontWeight: 900, fontSize: 22 }}>
          Профиль тренера
        </h1>

        <div className="mt-5" style={{ background: '#060919', border: '1px solid #26252F', borderRadius: 14, padding: '18px 20px' }}>
          <div className="font-overpass" style={{ fontWeight: 900, fontSize: 18 }}>
            {me?.firstName} {me?.lastName}
          </div>
          {me?.coachClubName && (
            <div className="font-overpass mt-1" style={{ color: '#AEABBB', fontSize: 13 }}>
              {me.coachClubName}
            </div>
          )}
        </div>

        <InviteCodeSection />

        <div className="mt-4 flex flex-col gap-2">
          <LinkButton label="Команда" onClick={() => router.push('/coach/team')} />
          <LinkButton label="Задания" onClick={() => router.push('/coach/assignments')} />
        </div>

        <div className="mt-6">
          <AccountSwitcher />
        </div>

        <button
          onClick={handleLogout}
          className="w-full font-overpass uppercase mt-4"
          style={{
            background: 'transparent',
            color: '#F9F8FE',
            border: '1px solid #26252F',
            padding: '14px 20px',
            borderRadius: 999,
            fontWeight: 800,
            fontSize: 12,
            letterSpacing: '0.02em',
            cursor: 'pointer',
          }}
        >
          Выйти
        </button>
      </div>

      <BottomNavigationCoach activeTab="profile" />
    </div>
  );
}

function LinkButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left font-overpass"
      style={{
        background: '#060919',
        border: '1px solid #26252F',
        borderRadius: 12,
        padding: '14px 16px',
        fontWeight: 700,
        fontSize: 14,
        color: '#F9F8FE',
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );
}
