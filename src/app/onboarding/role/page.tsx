'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getTelegramId } from '@/lib/auth';

type Role = 'ATHLETE' | 'COACH';

export default function OnboardingRolePage() {
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);
  const [selected, setSelected] = useState<Role | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const telegramId = getTelegramId();
      if (!telegramId) {
        router.push('/login');
        return;
      }
      try {
        const res = await fetch('/api/users/me', { cache: 'no-store' });
        if (!res.ok) {
          if (!cancelled) setIsChecking(false);
          return;
        }
        const data = await res.json();
        // Если у пользователя уже есть профиль соответствующей роли — пропускаем выбор
        if (!cancelled) {
          if (data.role === 'COACH' && data.hasCoachProfile) {
            router.replace('/coach/team');
            return;
          }
          if (data.role === 'ATHLETE' && data.hasAthleteProfile) {
            router.replace('/');
            return;
          }
          setIsChecking(false);
        }
      } catch {
        if (!cancelled) setIsChecking(false);
      }
    })();
    return () => { cancelled = true; };
  }, [router]);

  const handleContinue = async () => {
    if (!selected) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/users/set-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: selected }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error || 'Ошибка сохранения роли');
        return;
      }
      if (selected === 'COACH') {
        router.push('/onboarding/coach');
      } else {
        router.push('/onboarding/welcome');
      }
    } catch {
      setError('Сетевая ошибка');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isChecking) {
    return (
      <div className="min-h-screen bg-[#101530] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#A1FF4A]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#101530] text-white flex flex-col px-6 py-10 max-w-3xl md:mx-auto md:px-8">
      {/* Заголовок */}
      <div className="mb-8 md:mb-12">
        <h1
          className="font-overpass uppercase"
          style={{
            fontWeight: 900,
            fontSize: 28,
            letterSpacing: '0.02em',
            lineHeight: '110%',
          }}
        >
          Кто ты?
        </h1>
        <p
          className="font-overpass mt-2"
          style={{ color: '#AEABBB', fontWeight: 400, fontSize: 14, lineHeight: '140%' }}
        >
          Выбери роль, чтобы мы настроили приложение под тебя.
        </p>
      </div>

      {/* Варианты */}
      <div className="flex flex-col gap-3 md:gap-4 flex-1">
        <RoleCard
          role="ATHLETE"
          title="Спортсмен"
          description="Я тренируюсь, прокачиваю характеристики, играю или хочу играть в хоккей."
          selected={selected === 'ATHLETE'}
          onClick={() => setSelected('ATHLETE')}
        />
        <RoleCard
          role="COACH"
          title="Тренер"
          description="Я веду команду, выдаю задания и слежу за прогрессом игроков."
          selected={selected === 'COACH'}
          onClick={() => setSelected('COACH')}
        />
      </div>

      {error && (
        <div className="mt-4 p-3 bg-red-500/20 border border-red-500 rounded-lg">
          <p className="text-red-400 text-sm text-center">{error}</p>
        </div>
      )}

      <button
        onClick={handleContinue}
        disabled={!selected || isSubmitting}
        className="mt-8 font-overpass uppercase"
        style={{
          background: selected && !isSubmitting ? '#A1FF4A' : '#4a4f6a',
          color: selected && !isSubmitting ? '#101530' : '#AEABBB',
          fontWeight: 900,
          fontSize: 14,
          letterSpacing: '0.02em',
          padding: '18px 24px',
          borderRadius: 999,
          border: 'none',
          cursor: selected && !isSubmitting ? 'pointer' : 'not-allowed',
          transition: 'all 0.2s ease',
        }}
      >
        {isSubmitting ? 'Сохраняю...' : 'Продолжить'}
      </button>
    </div>
  );
}

interface RoleCardProps {
  role: Role;
  title: string;
  description: string;
  selected: boolean;
  onClick: () => void;
}

function RoleCard({ title, description, selected, onClick }: RoleCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left w-full"
      style={{
        background: '#060919',
        border: `2px solid ${selected ? '#A1FF4A' : '#26252F'}`,
        borderRadius: 16,
        padding: '20px 18px',
        cursor: 'pointer',
        transition: 'border-color 0.2s ease, transform 0.1s ease',
      }}
    >
      <div className="flex items-start gap-3">
        {/* Радио-индикатор */}
        <div
          className="shrink-0 mt-0.5"
          style={{
            width: 22,
            height: 22,
            borderRadius: '50%',
            border: `2px solid ${selected ? '#A1FF4A' : '#4a4f6a'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {selected && (
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: '#A1FF4A',
              }}
            />
          )}
        </div>
        <div className="flex-1">
          <div
            className="font-overpass uppercase"
            style={{
              fontWeight: 900,
              fontSize: 18,
              letterSpacing: '0.02em',
              color: selected ? '#A1FF4A' : '#F9F8FE',
              marginBottom: 6,
            }}
          >
            {title}
          </div>
          <div
            className="font-overpass"
            style={{ fontWeight: 400, fontSize: 13, lineHeight: '140%', color: '#AEABBB' }}
          >
            {description}
          </div>
        </div>
      </div>
    </button>
  );
}
