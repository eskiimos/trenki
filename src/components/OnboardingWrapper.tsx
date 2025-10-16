'use client';

import React, { useState, useEffect } from 'react';
import Onboarding from './Onboarding';

interface OnboardingWrapperProps {
  children: React.ReactNode;
}

export default function OnboardingWrapper({ children }: OnboardingWrapperProps) {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkUserRegistration();
  }, []);

  const checkUserRegistration = async () => {
    try {
      // Получаем Telegram ID пользователя
      const telegramId = (window as any).Telegram?.WebApp?.initDataUnsafe?.user?.id?.toString();
      
      console.log('OnboardingWrapper: Telegram WebApp:', (window as any).Telegram?.WebApp);
      console.log('OnboardingWrapper: telegramId:', telegramId);
      
      if (!telegramId) {
        // Если нет Telegram ID (открыто в браузере/PWA), показываем онбординг для регистрации
        console.log('OnboardingWrapper: No telegramId, showing onboarding for registration');
        setShowOnboarding(true);
        setIsLoading(false);
        return;
      }

      // Проверяем, есть ли пользователь в БД
      console.log('OnboardingWrapper: Checking user in DB...');
      const response = await fetch(`/api/users/check?telegramId=${telegramId}`);
      
      console.log('OnboardingWrapper: API response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('OnboardingWrapper: API response data:', data);
        
        // Если пользователь не существует ИЛИ у него не заполнен профиль (нет возраста или пола), показываем онбординг
        const needsOnboarding = !data.exists || !data.user?.profile?.age || !data.user?.profile?.gender;
        console.log('OnboardingWrapper: Needs onboarding:', needsOnboarding, {
          exists: data.exists,
          hasAge: !!data.user?.profile?.age,
          hasGender: !!data.user?.profile?.gender
        });
        
        setShowOnboarding(needsOnboarding);
      } else {
        // Если ошибка API, показываем онбординг
        console.log('OnboardingWrapper: API error, showing onboarding');
        setShowOnboarding(true);
      }
    } catch (error) {
      console.error('OnboardingWrapper: Error checking user registration:', error);
      // При ошибке показываем онбординг
      setShowOnboarding(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOnboardingComplete = async () => {
    // Здесь будет логика сохранения пользователя после завершения онбординга
    setShowOnboarding(false);
  };

  if (isLoading) {
    // Показываем загрузку
    return (
      <div className="fixed inset-0 bg-[#0A0E1A] flex items-center justify-center">
        <div className="text-white text-xl">Загрузка...</div>
      </div>
    );
  }

  if (showOnboarding) {
    return <Onboarding onComplete={handleOnboardingComplete} />;
  }

  return <>{children}</>;
}
