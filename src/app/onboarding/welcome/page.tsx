'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { getTelegramId } from '@/lib/auth';

export default function OnboardingWelcomePage() {
  const router = useRouter();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  useEffect(() => {
    const telegramId = getTelegramId();
    if (!telegramId) {
      router.push('/login');
      return;
    }
    setIsCheckingAuth(false);
  }, [router]);

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-[#101530] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#A1FF4A]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#101530] flex flex-col">
      {/* Верхняя часть — фото с заголовком */}
      <div
        className="relative w-full overflow-hidden"
        style={{
          aspectRatio: '375 / 320',
          flexShrink: 0,
          borderRadius: '0 0 16px 16px',
        }}
      >
        <Image
          src="/images/onboarding/1_start.webp"
          alt="Тренировка на льду"
          fill
          priority
          sizes="100vw"
          style={{ objectFit: 'cover' }}
        />
        {/* Логотип — по центру картинки */}
        <div className="absolute inset-0 flex items-center justify-center">
          <h1
            className="font-overpass text-white"
            style={{
              fontWeight: 900,
              fontSize: 48,
              letterSpacing: '0.04em',
              lineHeight: '100%',
              textShadow: '0 2px 12px rgba(0,0,0,0.5)',
            }}
          >
            ТРЕНЬКИ
          </h1>
        </div>
      </div>

      {/* Текстовый блок */}
      <div className="flex-1 flex flex-col px-6 pt-4 pb-6">
        <div className="flex-1">
          <p
            className="font-overpass text-white"
            style={{
              fontWeight: 800,
              fontSize: 22,
              lineHeight: '125%',
              marginBottom: 24,
            }}
          >
            Привет, чемпион!<br />
            Добро пожаловать в цифровой мир хоккея!
            Здесь ты прокачаешь скилы, и&nbsp;… найдешь единомышленников!
          </p>

          <p
            className="font-overpass text-white"
            style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}
          >
            Тут тебя ждут:
          </p>
          <ul
            className="font-overpass text-white"
            style={{
              fontWeight: 400,
              fontSize: 13,
              lineHeight: '150%',
              listStyle: 'none',
              paddingLeft: 0,
              margin: 0,
            }}
          >
            {[
              'каталог тренировок от топ специалистов;',
              'персональные тренировки от ии-тренера;',
              'план-календарь тренировок, который подстраивается под тебя;',
              'геймификация и мотивация на каждом шагу.',
            ].map((item) => (
              <li
                key={item}
                style={{
                  position: 'relative',
                  paddingLeft: 16,
                  marginBottom: 2,
                }}
              >
                <span
                  style={{
                    position: 'absolute',
                    left: 4,
                    top: 7,
                    width: 4,
                    height: 4,
                    borderRadius: '50%',
                    background: '#A1FF4A',
                  }}
                />
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* Низ: кнопка + пагинация */}
        <div className="mt-8 flex flex-col items-center gap-3">
          <button
            onClick={() => router.push('/onboarding')}
            className="w-full font-overpass uppercase"
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
            Готов зажечь на льду по-новому?
          </button>
          <div
            className="font-overpass"
            style={{ color: '#AEABBB', fontSize: 12, fontWeight: 600 }}
          >
            1/2
          </div>
        </div>
      </div>
    </div>
  );
}
