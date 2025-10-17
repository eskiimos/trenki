'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { saveAuth, getTelegramId } from '@/lib/auth';

interface OnboardingProps {
  onComplete: () => void;
}

export default function Onboarding({ onComplete }: OnboardingProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedGender, setSelectedGender] = useState<'male' | 'female' | 'none' | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [age, setAge] = useState('');

  // Проверка заполненности всех полей
  const isFormValid = firstName.trim() !== '' && lastName.trim() !== '' && age.trim() !== '' && selectedGender !== null;

  const handleNext = async () => {
    if (currentStep === 1) {
      setCurrentStep(2);
    } else if (currentStep === 2) {
      // Сохраняем данные в БД перед переходом на экран успеха
      try {
        // Используем централизованную функцию получения ID
        const telegramId = getTelegramId();
        
        if (!telegramId) {
          console.error('No Telegram ID found');
          alert('Не удалось получить ID пользователя');
          return;
        }

        console.log('Registering user with ID:', telegramId);

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
            gender: selectedGender, // 'male', 'female', 'none'
          }),
        });

        if (response.ok) {
          const data = await response.json();
          console.log('User registered successfully:', data);
          
          // Сохраняем данные авторизации для автологина
          saveAuth({
            telegramId,
            firstName,
            lastName,
            username: (window as any).Telegram?.WebApp?.initDataUnsafe?.user?.username,
          });
          
          setCurrentStep(3);
        } else {
          const error = await response.json();
          console.error('Registration failed:', error);
          alert('Ошибка регистрации. Попробуйте снова.');
        }
      } catch (error) {
        console.error('Error during registration:', error);
        alert('Ошибка соединения. Попробуйте снова.');
      }
    } else {
      // После третьего экрана завершаем онбординг
      onComplete();
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-[#101530] flex flex-col">
      {/* Контент в зависимости от шага */}
      {currentStep === 1 ? (
        <div className="flex-1 flex flex-col">
          {/* Верхняя часть с логотипом и фоновой картинкой */}
          <div className="flex-1 flex items-center justify-center relative overflow-hidden rounded-b-2xl">
            {/* Фоновая картинка */}
            <Image
              src="/images/Onboarding-image.png"
              alt="Onboarding background"
              fill
              className="object-cover"
              priority
            />
            {/* Логотип поверх картинки */}
            <h1 className="relative z-10 text-white text-6xl font-bold tracking-wider drop-shadow-2xl">ТРЕНЬКИ</h1>
          </div>

          {/* Нижняя часть с текстом */}
          <div className="px-6 py-8 flex flex-col" style={{ background: 'linear-gradient(182.77deg, #101530 69.24%, #060919 97.69%)' }}>
            <h2 className="text-white text-2xl font-bold mb-4">
              Привет, чемпион!
            </h2>
            <h3 className="text-white text-xl font-bold mb-6">
              Добро пожаловать в цифровой мир хоккея! Здесь ты прокачаешь скилы, и ... найдешь единомышленников!
            </h3>

            <div className="text-white text-base space-y-2 mb-8">
              <p className="text-gray-300">Тут тебя ждут:</p>
              <ul className="space-y-2 ml-4">
                <li className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>каталог тренировок от топ специалистов;</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>персональные тренировки от ии-тренера;</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>план-календарь тренировок, который подстраивается под тебя;</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>геймификация и мотивация на каждом шагу.</span>
                </li>
              </ul>
            </div>

            {/* Кнопка */}
            <button
              onClick={handleNext}
              className="w-full bg-[#A1FF4A] text-[#0A0E1A] py-4 mb-6 hover:opacity-90 transition-opacity"
              style={{ 
                borderRadius: '32px',
                fontFamily: 'Overpass',
                fontWeight: 700,
                fontSize: '14px',
                lineHeight: '120%',
                letterSpacing: '0.5px',
                textTransform: 'uppercase'
              }}
            >
              ГОТОВ ЗАЖЕЧЬ НА ЛЬДУ ПО-НОВОМУ?
            </button>

            {/* Индикатор страницы */}
            <div className="text-center text-gray-400 text-sm">
              1/3
            </div>
          </div>
        </div>
      ) : currentStep === 2 ? (
        <div className="flex-1 flex flex-col relative">
          {/* Фоновое изображение */}
          <Image
            src="/images/onboarding/registration-bg.png"
            alt="Registration background"
            fill
            className="object-cover"
            priority
          />

          {/* Контент поверх фона */}
          <div className="relative z-10 flex-1 flex flex-col justify-between px-6 py-8">
            {/* Кнопка назад */}
            <button
              onClick={() => setCurrentStep(1)}
              className="self-start mb-4"
            >
              <Image
                src="/icons/icon-action-back.svg"
                alt="Назад"
                width={24}
                height={24}
              />
            </button>

            {/* Форма регистрации по центру */}
            <div className="flex-1 flex items-center justify-center">
              <div className="w-full max-w-md space-y-2">
                {/* Заголовок ближе к форме */}
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
                    height: '44px'
                  }}
                  onFocus={(e) => e.target.style.border = '1px solid #A1FF4A'}
                  onBlur={(e) => e.target.style.border = '1px solid transparent'}
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
                    height: '44px'
                  }}
                  onFocus={(e) => e.target.style.border = '1px solid #A1FF4A'}
                  onBlur={(e) => e.target.style.border = '1px solid transparent'}
                />
              </div>

              {/* Возраст */}
              <div className="mt-8">
                <label className="text-white text-sm mb-2 block">СКОЛЬКО ТЕБЕ ЛЕТ?</label>
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
                    height: '44px'
                  }}
                  onFocus={(e) => e.target.style.border = '1px solid #A1FF4A'}
                  onBlur={(e) => e.target.style.border = '1px solid transparent'}
                />
              </div>

              {/* Пол */}
              <div className="mt-8">
                <label className="text-white text-sm mb-2 block">ПОЛ</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedGender('male')}
                    className="rounded-full font-bold transition-all"
                    style={{ 
                      background: selectedGender === 'male' ? '#A1FF4A' : '#AEABBB33',
                      color: selectedGender === 'male' ? '#0A0E1A' : 'white',
                      width: '44px',
                      height: '44px'
                    }}
                  >
                    М
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedGender('female')}
                    className="rounded-full font-bold transition-all"
                    style={{ 
                      background: selectedGender === 'female' ? '#A1FF4A' : '#AEABBB33',
                      color: selectedGender === 'female' ? '#0A0E1A' : 'white',
                      width: '44px',
                      height: '44px'
                    }}
                  >
                    Ж
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedGender('none')}
                    className="px-4 rounded-full text-xs font-bold transition-all"
                    style={{ 
                      background: selectedGender === 'none' ? '#A1FF4A' : '#AEABBB33',
                      color: selectedGender === 'none' ? '#0A0E1A' : 'white',
                      height: '44px'
                    }}
                  >
                    НЕ ХОЧУ УКАЗЫВАТЬ
                  </button>
                </div>
              </div>
            </div>
          </div>

            {/* Нижняя часть с кнопкой */}
            <div>
              {/* Кнопка */}
              <button
                onClick={handleNext}
                disabled={!isFormValid}
                className="w-full py-4 mb-6 transition-all"
                style={{ 
                  background: isFormValid ? '#A1FF4A' : '#A1FF4A33',
                  color: isFormValid ? '#0A0E1A' : '#FFFFFF',
                  borderRadius: '32px',
                  fontFamily: 'Overpass',
                  fontWeight: 700,
                  fontSize: '14px',
                  lineHeight: '120%',
                  letterSpacing: '0.5px',
                  textTransform: 'uppercase',
                  cursor: isFormValid ? 'pointer' : 'not-allowed',
                  opacity: isFormValid ? 1 : 0.6
                }}
              >
                ДАЛЕЕ
              </button>

              {/* Индикатор страницы */}
              <div className="text-center text-gray-400 text-sm">
                2/3
              </div>
            </div>
          </div>
        </div>
      ) : (
        // Третий экран - Успешная регистрация
        <div className="flex-1 flex flex-col relative">
          {/* Фоновое изображение */}
          <Image
            src="/images/onboarding/registration-bg.png"
            alt="Success background"
            fill
            className="object-cover"
            priority
          />

          {/* Контент поверх фона */}
          <div className="relative z-10 flex-1 flex flex-col justify-between px-6 py-8">
            {/* Центральный текст */}
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <h2 className="text-white text-4xl font-bold mb-4">
                  Отлично!
                </h2>
                <p className="text-white text-xl">
                  Рекомендации для тебя уже готовы.
                </p>
              </div>
            </div>

            {/* Нижняя часть с кнопкой */}
            <div>
              {/* Кнопка */}
              <button
                onClick={handleNext}
                className="w-full bg-[#A1FF4A] text-[#0A0E1A] py-4 mb-6 hover:opacity-90 transition-opacity"
                style={{ 
                  borderRadius: '32px',
                  fontFamily: 'Overpass',
                  fontWeight: 700,
                  fontSize: '14px',
                  lineHeight: '120%',
                  letterSpacing: '0.5px',
                  textTransform: 'uppercase'
                }}
              >
                К ТРЕНИРОВКАМ
              </button>

              {/* Индикатор страницы */}
              <div className="text-center text-gray-400 text-sm">
                3/3
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
