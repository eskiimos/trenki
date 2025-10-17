'use client';

import React, { useState, useEffect } from 'react';
import Onboarding from './Onboarding';
import { getTelegramId, isAuthenticated } from '@/lib/auth';

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
      console.log('OnboardingWrapper: Checking user registration...');
      
      // Проверяем, есть ли сохранённая авторизация
      if (isAuthenticated()) {
        console.log('OnboardingWrapper: User is authenticated, checking profile completeness...');
        
        const telegramId = getTelegramId();
        if (telegramId) {
          // Проверяем, заполнен ли профиль
          const response = await fetch(`/api/users/check?telegramId=${telegramId}`);
          if (response.ok) {
            const data = await response.json();
            if (data.exists && data.user?.profile?.age && data.user?.profile?.gender) {
              // Всё заполнено, пропускаем онбординг
              console.log('OnboardingWrapper: Profile complete, skipping onboarding');
              setShowOnboarding(false);
              setIsLoading(false);
              return;
            }
          }
        }
      }
      
      // Получаем Telegram ID через централизованную функцию
      const telegramId = getTelegramId();
      
      console.log('OnboardingWrapper: telegramId:', telegramId);
      
      if (!telegramId) {
        // Если нет ID, перенаправляем на страницу входа
        console.log('OnboardingWrapper: No telegramId, redirecting to login');
        window.location.href = '/login';
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
