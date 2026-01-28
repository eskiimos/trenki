'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { getTelegramId } from '@/lib/auth';

export default function OnboardingProfilePage() {
  const router = useRouter();
  const [selectedGender, setSelectedGender] = useState<'male' | 'female' | 'none' | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  // Проверяем авторизацию при загрузке страницы
  useEffect(() => {
    const checkAuth = () => {
      const telegramId = getTelegramId();
      
      if (!telegramId) {
        console.log('❌ Пользователь не авторизован, редирект на /login');
        router.push('/login');
        return;
      }
      
      console.log('✅ Пользователь авторизован:', telegramId);
      setIsCheckingAuth(false);
    };

    checkAuth();
  }, [router]);

  const isFormValid = 
    firstName.trim() !== '' && 
    lastName.trim() !== '' && 
    birthDate.trim() !== '' && 
    selectedGender !== null;

  const handleSubmit = async () => {
    if (!isFormValid) return;

    setIsLoading(true);

    try {
      const telegramId = getTelegramId();
      
      if (!telegramId) {
        alert('Ошибка: не удалось получить ID пользователя');
        return;
      }

      const requestData = {
        telegramId,
        firstName,
        lastName,
        birthDate,
        gender: selectedGender,
      };
      
      console.log('📤 Sending registration data:', requestData);

      const response = await fetch('/api/users/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      if (response.ok) {
        console.log('✅ Базовая информация сохранена, переход к характеристикам');
        router.push('/onboarding/characteristics');
      } else {
        const error = await response.json();
        console.error('Profile completion failed:', error);
        alert('Ошибка сохранения профиля. Попробуйте снова.');
      }
    } catch (error) {
      console.error('Error completing profile:', error);
      alert('Ошибка соединения. Попробуйте снова.');
    } finally {
      setIsLoading(false);
    }
  };

  // Показываем загрузку во время проверки авторизации
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-[#101530] flex items-center justify-center">
        <div className="text-white text-xl">Проверка авторизации...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#101530] flex flex-col relative">
      {/* Фоновое изображение */}
      <Image
        src="/images/onboarding/registration-bg.png"
        alt="Registration background"
        fill
        className="object-cover"
        priority
      />

      {/* Контент */}
      <div className="relative z-10 flex-1 flex flex-col justify-between px-6 py-8">
        {/* Кнопка назад */}
        <button
          onClick={() => router.back()}
          className="self-start mb-4"
        >
          <Image
            src="/icons/icon-action-back.svg"
            alt="Назад"
            width={24}
            height={24}
          />
        </button>

        {/* Форма по центру */}
        <div className="flex-1 flex items-center justify-center">
          <div className="w-full max-w-md space-y-4">
            {/* Заголовок */}
            <h2 className="text-white text-2xl font-bold text-center mb-6">
              Познакомимся?
            </h2>

            {/* Имя */}
            <div>
              <label className="text-white text-sm mb-2 block">ИМЯ</label>
              <input
                type="text"
                placeholder="Имя"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full text-white placeholder-gray-400 px-4 border focus:outline-none transition-colors"
                style={{
                  background: '#AEABBB33',
                  borderRadius: '32px',
                  border: '1px solid transparent',
                  height: '44px',
                }}
                onFocus={(e) => (e.target.style.border = '1px solid #A1FF4A')}
                onBlur={(e) => (e.target.style.border = '1px solid transparent')}
              />
            </div>

            {/* Фамилия */}
            <div>
              <input
                type="text"
                placeholder="Фамилия"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full text-white placeholder-gray-400 px-4 border focus:outline-none transition-colors"
                style={{
                  background: '#AEABBB33',
                  borderRadius: '32px',
                  border: '1px solid transparent',
                  height: '44px',
                }}
                onFocus={(e) => (e.target.style.border = '1px solid #A1FF4A')}
                onBlur={(e) => (e.target.style.border = '1px solid transparent')}
              />
            </div>

            {/* Дата рождения */}
            <div>
              <label className="text-white text-sm mb-2 block">ДАТА РОЖДЕНИЯ</label>
              <input
                type="date"
                placeholder="Дата рождения"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
                className="w-full text-white placeholder-gray-400 px-4 border focus:outline-none transition-colors"
                style={{
                  background: '#AEABBB33',
                  borderRadius: '32px',
                  border: '1px solid transparent',
                  height: '44px',
                  colorScheme: 'dark',
                }}
                onFocus={(e) => (e.target.style.border = '1px solid #A1FF4A')}
                onBlur={(e) => (e.target.style.border = '1px solid transparent')}
              />
            </div>

            {/* Пол */}
            <div>
              <label className="text-white text-sm mb-2 block">ПОЛ</label>
              <div className="flex gap-3">
                <button
                  onClick={() => setSelectedGender('male')}
                  className={`flex-1 py-3 rounded-full font-medium transition-all ${
                    selectedGender === 'male'
                      ? 'bg-[#A1FF4A] text-[#0A0E1A]'
                      : 'bg-[#AEABBB33] text-white'
                  }`}
                >
                  Мужской
                </button>
                <button
                  onClick={() => setSelectedGender('female')}
                  className={`flex-1 py-3 rounded-full font-medium transition-all ${
                    selectedGender === 'female'
                      ? 'bg-[#A1FF4A] text-[#0A0E1A]'
                      : 'bg-[#AEABBB33] text-white'
                  }`}
                >
                  Женский
                </button>
              </div>
              <button
                onClick={() => setSelectedGender('none')}
                className={`w-full mt-2 py-2 rounded-full text-sm font-medium transition-all ${
                  selectedGender === 'none'
                    ? 'bg-[#A1FF4A] text-[#0A0E1A]'
                    : 'bg-transparent text-gray-400 border border-gray-600'
                }`}
              >
                Не указывать
              </button>
            </div>
          </div>
        </div>

        {/* Кнопка внизу */}
        <div className="space-y-4">
          <button
            onClick={handleSubmit}
            disabled={!isFormValid || isLoading}
            className={`w-full py-4 rounded-full font-bold text-sm uppercase tracking-wider transition-all ${
              isFormValid && !isLoading
                ? 'bg-[#A1FF4A] text-[#0A0E1A] hover:opacity-90'
                : 'bg-gray-600 text-gray-400 cursor-not-allowed'
            }`}
          >
            {isLoading ? 'Сохранение...' : 'Сохранить'}
          </button>

          <div className="text-center text-gray-400 text-sm">2/2</div>
        </div>
      </div>
    </div>
  );
}
