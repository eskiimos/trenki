'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { getTelegramId } from '@/lib/auth';

export default function OnboardingCoachTeamPage() {
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);
  const [teamName, setTeamName] = useState('');
  const [clubName, setClubName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdCode, setCreatedCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const telegramId = getTelegramId();
    if (!telegramId) {
      router.push('/login');
      return;
    }
    setIsChecking(false);
  }, [router]);

  const handleCreate = async () => {
    if (!teamName.trim()) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: teamName.trim(),
          clubName: clubName.trim() || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error || 'Ошибка создания команды');
        return;
      }
      const data = await res.json();
      setCreatedCode(data.team.inviteCode);
    } catch {
      setError('Сетевая ошибка');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFinish = () => {
    router.push('/coach/team');
  };

  if (isChecking) {
    return (
      <div className="min-h-screen bg-[#101530] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#A1FF4A]" />
      </div>
    );
  }

  // Экран успеха — показываем сгенерированный код
  if (createdCode) {
    return (
      <div className="min-h-screen bg-[#101530] text-white flex flex-col px-6 py-10 max-w-3xl md:mx-auto md:px-8">
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <div
            style={{
              width: 88,
              height: 88,
              borderRadius: '50%',
              background: '#A1FF4A',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 24,
            }}
          >
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
              <path d="M5 13l4 4L19 7" stroke="#101530" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h1
            className="font-overpass uppercase"
            style={{ fontWeight: 900, fontSize: 24, marginBottom: 12 }}
          >
            Команда создана
          </h1>
          <p
            className="font-overpass"
            style={{ color: '#AEABBB', fontSize: 14, lineHeight: '140%', maxWidth: 320 }}
          >
            Поделись кодом приглашения с игроками — они вступят в команду одним нажатием.
          </p>

          <div
            className="mt-8 w-full"
            style={{
              background: '#060919',
              border: '1px solid #26252F',
              borderRadius: 16,
              padding: '20px 16px',
            }}
          >
            <div
              className="font-overpass uppercase text-center"
              style={{ color: '#9B99AA', fontSize: 11, fontWeight: 700, letterSpacing: '0.5px', marginBottom: 10 }}
            >
              Код приглашения
            </div>
            <div
              className="font-overpass text-center"
              style={{
                color: '#A1FF4A',
                fontWeight: 900,
                fontSize: 38,
                letterSpacing: '0.3em',
                lineHeight: '100%',
              }}
            >
              {createdCode}
            </div>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(createdCode);
              }}
              className="mt-4 w-full font-overpass uppercase"
              style={{
                background: 'transparent',
                color: '#F9F8FE',
                border: '1px solid #445CFF',
                borderRadius: 999,
                padding: '12px 18px',
                fontWeight: 800,
                fontSize: 12,
                letterSpacing: '0.02em',
                cursor: 'pointer',
              }}
            >
              Скопировать код
            </button>
          </div>
        </div>

        <button
          onClick={handleFinish}
          className="font-overpass uppercase"
          style={{
            background: '#A1FF4A',
            color: '#101530',
            fontWeight: 900,
            fontSize: 14,
            letterSpacing: '0.02em',
            padding: '18px 24px',
            borderRadius: 999,
            border: 'none',
            cursor: 'pointer',
          }}
        >
          В командную комнату
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#101530] text-white flex flex-col px-6 py-8 max-w-3xl md:mx-auto md:px-8">
      <button onClick={() => router.push('/onboarding/coach')} className="self-start mb-4">
        <Image src="/icons/icon-action-back.svg" alt="Назад" width={32} height={32} />
      </button>

      <h1
        className="font-overpass uppercase"
        style={{ fontWeight: 900, fontSize: 24, letterSpacing: '0.02em', lineHeight: '110%' }}
      >
        Создай команду
      </h1>
      <p
        className="font-overpass mt-2"
        style={{ color: '#AEABBB', fontWeight: 400, fontSize: 14, lineHeight: '140%' }}
      >
        После создания мы сгенерируем код, по которому игроки смогут присоединиться.
      </p>

      <div className="flex flex-col gap-4 mt-6">
        <Field label="Название команды" value={teamName} onChange={setTeamName} placeholder="Молния-2014" />
        <Field label="Клуб (необязательно)" value={clubName} onChange={setClubName} placeholder="ХК «Авангард»" />
      </div>

      {error && (
        <div className="mt-4 p-3 bg-red-500/20 border border-red-500 rounded-lg">
          <p className="text-red-400 text-sm text-center">{error}</p>
        </div>
      )}

      <div className="mt-auto pt-8">
        <button
          onClick={handleCreate}
          disabled={!teamName.trim() || isSubmitting}
          className="w-full font-overpass uppercase"
          style={{
            background: teamName.trim() && !isSubmitting ? '#A1FF4A' : '#4a4f6a',
            color: teamName.trim() && !isSubmitting ? '#101530' : '#AEABBB',
            fontWeight: 900,
            fontSize: 14,
            letterSpacing: '0.02em',
            padding: '18px 24px',
            borderRadius: 999,
            border: 'none',
            cursor: teamName.trim() && !isSubmitting ? 'pointer' : 'not-allowed',
          }}
        >
          {isSubmitting ? 'Создаю...' : 'Создать команду'}
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span
        className="font-overpass uppercase"
        style={{ color: '#9B99AA', fontWeight: 700, fontSize: 11, letterSpacing: '0.5px' }}
      >
        {label}
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full font-overpass"
        style={{
          background: '#060919',
          color: '#F9F8FE',
          border: '1px solid #26252F',
          borderRadius: 12,
          padding: '14px 16px',
          fontSize: 15,
          fontWeight: 600,
          outline: 'none',
        }}
      />
    </label>
  );
}
