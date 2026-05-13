'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { getTelegramId } from '@/lib/auth';

export default function OnboardingCoachPage() {
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [clubName, setClubName] = useState('');
  const [position, setPosition] = useState('');
  const [experienceYears, setExperienceYears] = useState('');
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
        if (!cancelled) {
          if (data.firstName) setFirstName(data.firstName);
          if (data.lastName) setLastName(data.lastName);
          setIsChecking(false);
        }
      } catch {
        if (!cancelled) setIsChecking(false);
      }
    })();
    return () => { cancelled = true; };
  }, [router]);

  const isFormValid = firstName.trim() !== '' && lastName.trim() !== '';

  const handleSubmit = async () => {
    if (!isFormValid) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const expYears = experienceYears.trim() === '' ? null : Number(experienceYears);
      const res = await fetch('/api/users/coach-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          clubName: clubName.trim() || null,
          position: position.trim() || null,
          experienceYears: expYears,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error || 'Ошибка сохранения');
        return;
      }
      router.push('/onboarding/coach/team');
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
    <div
      className="min-h-screen bg-[#101530] text-white flex flex-col px-6 pb-8 max-w-3xl md:mx-auto md:px-8"
      style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 32px)' }}
    >
      {/* Кнопка назад */}
      <button onClick={() => router.push('/onboarding/role')} className="self-start mb-4">
        <Image src="/icons/icon-action-back.svg" alt="Назад" width={32} height={32} />
      </button>

      <h1
        className="font-overpass uppercase"
        style={{ fontWeight: 900, fontSize: 24, letterSpacing: '0.02em', lineHeight: '110%' }}
      >
        Расскажи о себе
      </h1>
      <p
        className="font-overpass mt-2"
        style={{ color: '#AEABBB', fontWeight: 400, fontSize: 14, lineHeight: '140%' }}
      >
        Эта информация будет видна твоей команде.
      </p>

      <div className="flex flex-col gap-4 mt-6 md:gap-5">
        <Field label="Имя" value={firstName} onChange={setFirstName} placeholder="Иван" />
        <Field label="Фамилия" value={lastName} onChange={setLastName} placeholder="Иванов" />
        <Field label="Клуб (необязательно)" value={clubName} onChange={setClubName} placeholder="ХК «Авангард»" />
        <Field label="Должность (необязательно)" value={position} onChange={setPosition} placeholder="Главный тренер" />
        <Field
          label="Стаж в годах (необязательно)"
          value={experienceYears}
          onChange={(v) => setExperienceYears(v.replace(/\D/g, '').slice(0, 2))}
          placeholder="5"
          inputMode="numeric"
        />
      </div>

      {error && (
        <div className="mt-4 p-3 bg-red-500/20 border border-red-500 rounded-lg">
          <p className="text-red-400 text-sm text-center">{error}</p>
        </div>
      )}

      <div className="mt-auto pt-8">
        <button
          onClick={handleSubmit}
          disabled={!isFormValid || isSubmitting}
          className="w-full font-overpass uppercase"
          style={{
            background: isFormValid && !isSubmitting ? '#A1FF4A' : '#4a4f6a',
            color: isFormValid && !isSubmitting ? '#101530' : '#AEABBB',
            fontWeight: 900,
            fontSize: 14,
            letterSpacing: '0.02em',
            padding: '18px 24px',
            borderRadius: 999,
            border: 'none',
            cursor: isFormValid && !isSubmitting ? 'pointer' : 'not-allowed',
          }}
        >
          {isSubmitting ? 'Сохраняю...' : 'Продолжить'}
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
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  inputMode?: 'text' | 'numeric';
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
        inputMode={inputMode}
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
