'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { getTelegramId } from '@/lib/auth';

export default function OnboardingProfilePage() {
  const router = useRouter();
  const [selectedGender, setSelectedGender] = useState<'male' | 'female' | 'none' | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [age, setAge] = useState('');
  const [email, setEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [isCodeSent, setIsCodeSent] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSendingCode, setIsSendingCode] = useState(false);

  const isFormValid = 
    firstName.trim() !== '' && 
    lastName.trim() !== '' && 
    age.trim() !== '' && 
    selectedGender !== null &&
    email.trim() !== '' &&
    isVerified;

  const sendVerificationCode = async () => {
    if (!email || !email.includes('@')) {
      alert('Введите корректный email');
      return;
    }

    setIsSendingCode(true);

    try {
      const response = await fetch('/api/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (response.ok) {
        setIsCodeSent(true);
        alert('Код отправлен на ваш email! Проверьте почту.');
      } else {
        const error = await response.json();
        alert(error.error || 'Ошибка отправки кода');
      }
    } catch (error) {
      console.error('Error sending code:', error);
      alert('Ошибка соединения');
    } finally {
      setIsSendingCode(false);
    }
  };

  const verifyCode = async () => {
    if (!verificationCode || verificationCode.length !== 4) {
      alert('Введите 4-значный код');
      return;
    }

    try {
      const response = await fetch(
        `/api/verify-email?email=${encodeURIComponent(email)}&code=${verificationCode}`
      );

      if (response.ok) {
        setIsVerified(true);
        alert('✅ Email подтверждён!');
      } else {
        const error = await response.json();
        alert(error.error || 'Неверный код');
      }
    } catch (error) {
      console.error('Error verifying code:', error);
      alert('Ошибка проверки кода');
    }
  };

  const handleSubmit = async () => {
    if (!isFormValid) return;

    setIsLoading(true);

    try {
      const telegramId = getTelegramId();
      
      if (!telegramId) {
        alert('Ошибка: не удалось получить ID пользователя');
        return;
      }

      const response = await fetch('/api/users/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          telegramId,
          firstName,
          lastName,
          age,
          gender: selectedGender,
          email,
          emailVerified: true,
        }),
      });

      if (response.ok) {
        console.log('Profile completed successfully');
        router.push('/');
        router.refresh();
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

            {/* Возраст */}
            <div>
              <input
                type="number"
                placeholder="Возраст"
                value={age}
                onChange={(e) => setAge(e.target.value)}
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

            {/* Email */}
            <div>
              <label className="text-white text-sm mb-2 block">EMAIL</label>
              <div className="flex gap-2">
                <input
                  type="email"
                  placeholder="email@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isVerified}
                  className="flex-1 text-white placeholder-gray-400 px-4 border focus:outline-none transition-colors disabled:opacity-50"
                  style={{
                    background: '#AEABBB33',
                    borderRadius: '32px',
                    border: '1px solid transparent',
                    height: '44px',
                  }}
                  onFocus={(e) => (e.target.style.border = '1px solid #A1FF4A')}
                  onBlur={(e) => (e.target.style.border = '1px solid transparent')}
                />
                {!isVerified && (
                  <button
                    onClick={sendVerificationCode}
                    disabled={!email || isSendingCode}
                    className="px-6 py-2 rounded-full font-medium bg-[#A1FF4A] text-[#0A0E1A] disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                  >
                    {isSendingCode ? '...' : isCodeSent ? 'Повторить' : 'Отправить'}
                  </button>
                )}
                {isVerified && (
                  <div className="flex items-center px-4">
                    <span className="text-[#A1FF4A] text-2xl">✓</span>
                  </div>
                )}
              </div>
            </div>

            {/* Код верификации */}
            {isCodeSent && !isVerified && (
              <div>
                <label className="text-white text-sm mb-2 block">КОД ИЗ EMAIL</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="1234"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    maxLength={4}
                    className="flex-1 text-white placeholder-gray-400 px-4 border focus:outline-none transition-colors text-center text-2xl tracking-widest"
                    style={{
                      background: '#AEABBB33',
                      borderRadius: '32px',
                      border: '1px solid transparent',
                      height: '44px',
                    }}
                    onFocus={(e) => (e.target.style.border = '1px solid #A1FF4A')}
                    onBlur={(e) => (e.target.style.border = '1px solid transparent')}
                  />
                  <button
                    onClick={verifyCode}
                    disabled={verificationCode.length !== 4}
                    className="px-6 py-2 rounded-full font-medium bg-[#A1FF4A] text-[#0A0E1A] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Проверить
                  </button>
                </div>
                <p className="text-gray-400 text-xs mt-2">Проверьте почту и введите 4-значный код</p>
              </div>
            )}

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
